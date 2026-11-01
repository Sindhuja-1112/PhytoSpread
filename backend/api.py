
from pathlib import Path
import json
import io
import base64
from threading import Lock

import torch
import torch.nn as nn
from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from torchvision import models, transforms

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "efficientnet_b0_potato.pth"
CLASS_PATH = MODEL_DIR / "class_names.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

app = FastAPI(title="PhytoSpread Disease Prediction API")

# Development configuration. Restrict allowed origins before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])

def load_model():
    if not MODEL_PATH.exists() or not CLASS_PATH.exists():
        raise RuntimeError("Trained model or class_names.json not found.")

    with open(CLASS_PATH, "r", encoding="utf-8") as f:
        classes = json.load(f)

    model = models.efficientnet_b0(weights=None)
    model.classifier[1] = nn.Linear(
        model.classifier[1].in_features, len(classes)
    )

    try:
        state = torch.load(
            MODEL_PATH, map_location=DEVICE, weights_only=True
        )
    except TypeError:
        state = torch.load(MODEL_PATH, map_location=DEVICE)

    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model, classes

model, class_names = load_model()
gradcam_lock = Lock()


def _encode_png(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def generate_gradcam(
    input_tensor: torch.Tensor,
    original_image: Image.Image,
    target_index: int,
) -> tuple[str, str]:
    """Generate a Grad-CAM heatmap and overlay for one prediction."""
    target_layer = model.features[-1]
    activation = None

    def capture_activations(_module, _inputs, output):
        nonlocal activation
        activation = output
        activation.retain_grad()

    with gradcam_lock:
        forward_handle = target_layer.register_forward_hook(capture_activations)

        try:
            model.eval()
            model.zero_grad(set_to_none=True)
            with torch.enable_grad():
                logits = model(input_tensor)
                logits[0, target_index].backward()

            if activation is None or activation.grad is None:
                raise RuntimeError("Grad-CAM hook did not capture model data.")

            weights = activation.grad.mean(dim=(2, 3), keepdim=True)
            cam = (weights * activation).sum(dim=1).squeeze(0).relu()
            cam_min, cam_max = cam.min(), cam.max()
            if not torch.isfinite(cam).all() or float((cam_max - cam_min).item()) <= 0:
                raise RuntimeError("Grad-CAM produced an empty or invalid activation.")

            cam = (cam - cam_min) / (cam_max - cam_min)
            cam = torch.nn.functional.interpolate(
                cam.unsqueeze(0).unsqueeze(0),
                size=(224, 224),
                mode="bilinear",
                align_corners=False,
            ).squeeze().clamp(0, 1)
            heatmap = (cam.detach().cpu() * 255).to(torch.uint8)
            grayscale_heatmap = Image.frombytes(
                "L", (224, 224), heatmap.numpy().tobytes()
            )

            # Grad-CAM highlights regions influencing the model, not verified infected tissue.
            red = grayscale_heatmap
            green = grayscale_heatmap.point(
                lambda value: max(0, 255 - abs(value - 128) * 2)
            )
            blue = grayscale_heatmap.point(lambda value: 255 - value)
            heatmap_image = Image.merge("RGB", (red, green, blue))

            heatmap_image = heatmap_image.resize(
                original_image.size, Image.Resampling.BILINEAR
            )
            alpha = grayscale_heatmap.resize(
                original_image.size, Image.Resampling.BILINEAR
            ).point(lambda value: int(value * 0.55))
            overlay = Image.merge("RGBA", (*heatmap_image.split(), alpha))
            return _encode_png(heatmap_image), _encode_png(overlay)
        finally:
            forward_handle.remove()
            model.zero_grad(set_to_none=True)
            activation = None


@app.get("/")
def home():
    return {
        "service": "PhytoSpread API",
        "status": "running",
        "device": str(DEVICE),
        "classes": class_names,
    }


@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": True}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, PNG, or WebP leaf image.",
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller.")

    try:
        with Image.open(io.BytesIO(contents)) as uploaded_image:
            image = uploaded_image.convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The image could not be read.")

    tensor = None
    try:
        tensor = transform(image).unsqueeze(0).to(DEVICE)

        with torch.inference_mode():
            logits = model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0]
            confidence, index = probabilities.max(dim=0)
            predicted_index = index.item()
            confidence_value = float(confidence.item())
            probability_values = [
                round(float(probabilities[i].item()), 4)
                for i in range(len(class_names))
            ]
            logits = None
            probabilities = None
            confidence = None
            index = None

        # This is a provisional threshold, not a calibrated uncertainty estimate.
        uncertain = confidence_value < 0.70
        heatmap_base64 = None
        overlay_base64 = None
        gradcam_error = None
        try:
            heatmap_base64, overlay_base64 = generate_gradcam(
                tensor, image, predicted_index
            )
        except (RuntimeError, ValueError, OSError) as exc:
            gradcam_error = f"Grad-CAM generation failed: {exc}"

        response = {
            "predicted_class": class_names[predicted_index],
            "confidence": round(confidence_value, 4),
            "confidence_percent": round(confidence_value * 100, 2),
            "uncertain": uncertain,
            "probabilities": {
                class_names[i]: probability_values[i]
                for i in range(len(class_names))
            },
            "model": "EfficientNet-B0",
            "note": "Model scores are not calibrated probabilities of correctness.",
            "heatmap_base64": heatmap_base64,
            "overlay_base64": overlay_base64,
        }
        if gradcam_error is not None:
            response["gradcam_error"] = gradcam_error
        return response
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=500, detail=f"Prediction failed: {exc}"
        ) from exc
    finally:
        tensor = None
        image = None
        contents = None
