
from pathlib import Path
import json

import torch
import torch.nn as nn
from PIL import Image, UnidentifiedImageError
from torchvision import models, transforms

# Project paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "efficientnet_b0_potato.pth"
CLASS_PATH = MODEL_DIR / "class_names.json"

IMAGE_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Same ImageNet normalization used during training
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(IMAGE_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

def main():
    if not MODEL_PATH.exists() or not CLASS_PATH.exists():
        raise FileNotFoundError(
            "Model files are missing. Check the models folder."
        )

    with open(CLASS_PATH, "r", encoding="utf-8") as f:
        classes = json.load(f)

    # Recreate the same EfficientNet-B0 architecture
    model = models.efficientnet_b0(weights=None)
    model.classifier[1] = nn.Linear(
        model.classifier[1].in_features, len(classes)
    )

    # Load your trained weights
    try:
        state_dict = torch.load(
            MODEL_PATH, map_location=DEVICE, weights_only=True
        )
    except TypeError:
        state_dict = torch.load(MODEL_PATH, map_location=DEVICE)

    model.load_state_dict(state_dict)
    model.to(DEVICE)
    model.eval()

    print(f"Model loaded successfully on: {DEVICE}")
    print("Classes:", classes)

    image_path = input(
        "\nEnter the full path of a potato leaf image: "
    ).strip().strip('"')

    path = Path(image_path)

    if not path.is_file():
        print("Image file not found. Check the path and try again.")
        return

    try:
        with Image.open(path) as image:
            image = image.convert("RGB")
            image_tensor = transform(image).unsqueeze(0).to(DEVICE)
    except (UnidentifiedImageError, OSError):
        print("Could not open this image. Try a JPG or PNG file.")
        return

    with torch.inference_mode():
        logits = model(image_tensor)
        probabilities = torch.softmax(logits, dim=1)[0]

    confidence, predicted_index = probabilities.max(dim=0)

    print("\n--- PHY TOSPREAD DISEASE PREDICTION ---")
    print("Predicted class:", classes[predicted_index.item()])
    print(f"Model confidence: {confidence.item() * 100:.2f}%")
    print("\nScores for each class:")

    for index in probabilities.argsort(descending=True).tolist():
        print(f"{classes[index]}: {probabilities[index].item() * 100:.2f}%")

    print(
        "\nNote: These scores are model probabilities, not "
        "guaranteed probabilities of being correct."
    )

if __name__ == "__main__":
    main()
