
from pathlib import Path
import copy
import json
import random

import numpy as np
import torch
import torch.nn as nn
import matplotlib.pyplot as plt
import seaborn as sns

from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

# ============================================================
# 1. CONFIGURATION
# ============================================================

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "dataset"
OUTPUT_DIR = ROOT / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
IMAGE_SIZE = 224
BATCH_SIZE = 32
HEAD_EPOCHS = 5
FINETUNE_EPOCHS = 8
PATIENCE = 3

# Set to True only if you want to require an NVIDIA GPU.
REQUIRE_GPU = True

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)

if REQUIRE_GPU and not torch.cuda.is_available():
    raise RuntimeError(
        "NVIDIA GPU not detected by PyTorch. "
        "Fix your CUDA/PyTorch installation before training."
    )

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

if DEVICE.type == "cuda":
    torch.backends.cudnn.benchmark = True
    print("GPU:", torch.cuda.get_device_name(0))

print("Device:", DEVICE)
print("Dataset path:", DATA_DIR)

# ============================================================
# 2. CHECK DATASET
# ============================================================

if not DATA_DIR.exists():
    raise FileNotFoundError(
        f"Dataset folder not found: {DATA_DIR}"
    )

base_dataset = datasets.ImageFolder(str(DATA_DIR))
class_names = base_dataset.classes
targets = np.array(base_dataset.targets)
indices = np.arange(len(targets))

EXPECTED_CLASSES = {
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
}

if set(class_names) != EXPECTED_CLASSES:
    raise ValueError(
        "Expected exactly these three class folders:\n"
        f"{sorted(EXPECTED_CLASSES)}\n"
        f"Found instead: {class_names}\n"
        "Check dataset folder names and nesting."
    )

if len(base_dataset) < 30:
    raise ValueError(
        "Too few readable images were found. "
        "Check your dataset extraction."
    )

counts = np.bincount(
    targets, minlength=len(class_names)
)

print("\nClasses and image counts:")
for name, count in zip(class_names, counts):
    print(f"  {name}: {count}")

if np.any(counts < 10):
    raise ValueError(
        "At least one class has fewer than 10 images. "
        "Collect more data before making a meaningful split."
    )

# ============================================================
# 3. STRATIFIED TRAIN / VALIDATION / TEST SPLIT
# ============================================================

# 70% train, 15% validation, 15% test.
train_idx, temp_idx = train_test_split(
    indices,
    test_size=0.30,
    random_state=SEED,
    stratify=targets,
)

val_idx, test_idx = train_test_split(
    temp_idx,
    test_size=0.50,
    random_state=SEED,
    stratify=targets[temp_idx],
)

print("\nSplit sizes:")
print("Train:", len(train_idx))
print("Validation:", len(val_idx))
print("Test:", len(test_idx))

# ============================================================
# 4. IMAGE TRANSFORMS
# ============================================================

# ImageNet normalization matches the pretrained weights.
normalize = transforms.Normalize(
    mean=[0.485, 0.456, 0.406],
    std=[0.229, 0.224, 0.225],
)

train_transform = transforms.Compose([
    transforms.RandomResizedCrop(
        IMAGE_SIZE, scale=(0.80, 1.0)
    ),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(
        brightness=0.15,
        contrast=0.15,
        saturation=0.10,
    ),
    transforms.ToTensor(),
    normalize,
])

eval_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(IMAGE_SIZE),
    transforms.ToTensor(),
    normalize,
])

train_dataset = datasets.ImageFolder(
    str(DATA_DIR), transform=train_transform
)
eval_dataset = datasets.ImageFolder(
    str(DATA_DIR), transform=eval_transform
)

if train_dataset.classes != class_names:
    raise RuntimeError("Training class order mismatch.")

train_set = Subset(train_dataset, train_idx.tolist())
val_set = Subset(eval_dataset, val_idx.tolist())
test_set = Subset(eval_dataset, test_idx.tolist())

# num_workers=0 is reliable on Windows.
train_loader = DataLoader(
    train_set, batch_size=BATCH_SIZE,
    shuffle=True, num_workers=0,
    pin_memory=(DEVICE.type == "cuda"),
)

val_loader = DataLoader(
    val_set, batch_size=BATCH_SIZE,
    shuffle=False, num_workers=0,
    pin_memory=(DEVICE.type == "cuda"),
)

test_loader = DataLoader(
    test_set, batch_size=BATCH_SIZE,
    shuffle=False, num_workers=0,
    pin_memory=(DEVICE.type == "cuda"),
)

# ============================================================
# 5. LOAD PRETRAINED EFFICIENTNET-B0
# ============================================================

print("\nLoading pretrained EfficientNet-B0 weights...")
weights = EfficientNet_B0_Weights.DEFAULT
model = efficientnet_b0(weights=weights)

# Replace the ImageNet 1000-class output with 3 classes.
in_features = model.classifier[1].in_features
model.classifier[1] = nn.Linear(
    in_features, len(class_names)
)
model = model.to(DEVICE)

# ============================================================
# 6. TRAINING UTILITIES
# ============================================================

# Weight classes inversely to their frequency in the training split.
train_counts = np.bincount(
    targets[train_idx], minlength=len(class_names)
).astype(np.float32)

class_weights = len(train_idx) / (
    len(class_names) * train_counts
)

criterion = nn.CrossEntropyLoss(
    weight=torch.tensor(
        class_weights, dtype=torch.float32, device=DEVICE
    )
)

BEST_PATH = OUTPUT_DIR / "efficientnet_b0_potato.pth"
CLASS_PATH = OUTPUT_DIR / "class_names.json"
META_PATH = OUTPUT_DIR / "model_metadata.json"

best_val_loss = float("inf")
best_state = None


def train_one_epoch(loader, optimizer, phase):
    model.train()

    # Keep the frozen feature extractor's BatchNorm statistics
    # unchanged during classifier-head training.
    if phase == "head":
        model.features.eval()
        model.classifier.train()
    else:
        # Only the last two feature blocks are unfrozen.
        model.features.eval()
        model.features[-2:].train()
        model.classifier.train()

    total_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images = images.to(DEVICE)
        labels = labels.to(DEVICE)

        optimizer.zero_grad(set_to_none=True)

        outputs = model(images)
        loss = criterion(outputs, labels)

        loss.backward()
        optimizer.step()

        total_loss += loss.item() * labels.size(0)
        correct += (
            outputs.argmax(dim=1) == labels
        ).sum().item()
        total += labels.size(0)

    return total_loss / total, correct / total


def evaluate_loss(loader):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(DEVICE)
            labels = labels.to(DEVICE)

            outputs = model(images)
            loss = criterion(outputs, labels)

            total_loss += loss.item() * labels.size(0)
            correct += (
                outputs.argmax(dim=1) == labels
            ).sum().item()
            total += labels.size(0)

    return total_loss / total, correct / total


def train_phase(phase, epochs, optimizer):
    global best_val_loss, best_state

    patience_count = 0

    for epoch in range(epochs):
        train_loss, train_acc = train_one_epoch(
            train_loader, optimizer, phase
        )
        val_loss, val_acc = evaluate_loss(val_loader)

        print(
            f"{phase} | Epoch {epoch + 1}/{epochs} | "
            f"train loss={train_loss:.4f}, "
            f"train acc={train_acc:.4f} | "
            f"val loss={val_loss:.4f}, "
            f"val acc={val_acc:.4f}"
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = copy.deepcopy(
                model.state_dict()
            )
            torch.save(best_state, BEST_PATH)
            patience_count = 0
        else:
            patience_count += 1

        if patience_count >= PATIENCE:
            print("Early stopping for this training phase.")
            break

# ============================================================
# 7. PHASE ONE: TRAIN CLASSIFIER HEAD
# ============================================================

for param in model.features.parameters():
    param.requires_grad = False

for param in model.classifier.parameters():
    param.requires_grad = True

optimizer = torch.optim.AdamW(
    model.classifier.parameters(),
    lr=1e-3,
    weight_decay=1e-4,
)

print("\nPhase 1: training the classifier head")
train_phase("head", HEAD_EPOCHS, optimizer)

# ============================================================
# 8. PHASE TWO: FINE-TUNE LAST FEATURE BLOCKS
# ============================================================

# Restore the best head checkpoint before fine-tuning.
model.load_state_dict(
    torch.load(BEST_PATH, map_location=DEVICE, weights_only=True)
)

for param in model.features.parameters():
    param.requires_grad = False

for param in model.features[-2:].parameters():
    param.requires_grad = True

for param in model.classifier.parameters():
    param.requires_grad = True

optimizer = torch.optim.AdamW(
    [
        {
            "params": model.features[-2:].parameters(),
            "lr": 1e-5,
        },
        {
            "params": model.classifier.parameters(),
            "lr": 1e-4,
        },
    ],
    weight_decay=1e-4,
)

print("\nPhase 2: fine-tuning the last feature blocks")
train_phase("fine_tune", FINETUNE_EPOCHS, optimizer)

# ============================================================
# 9. RESTORE BEST CHECKPOINT AND EVALUATE ON TEST SET
# ============================================================

if best_state is None:
    raise RuntimeError("Training did not produce a checkpoint.")

model.load_state_dict(best_state)
model.eval()

all_labels = []
all_preds = []

with torch.no_grad():
    for images, labels in test_loader:
        images = images.to(DEVICE)
        outputs = model(images)
        preds = outputs.argmax(dim=1).cpu().numpy()

        all_preds.extend(preds.tolist())
        all_labels.extend(labels.numpy().tolist())

test_accuracy = accuracy_score(all_labels, all_preds)

print("\n========== HELD-OUT TEST RESULTS ==========")
print(f"Test accuracy: {test_accuracy:.4f}")
print(
    classification_report(
        all_labels,
        all_preds,
        labels=list(range(len(class_names))),
        target_names=class_names,
        digits=4,
        zero_division=0,
    )
)

cm = confusion_matrix(
    all_labels,
    all_preds,
    labels=list(range(len(class_names))),
)

plt.figure(figsize=(9, 6))
sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    xticklabels=class_names,
    yticklabels=class_names,
)
plt.xlabel("Predicted class")
plt.ylabel("True class")
plt.title("EfficientNet-B0 — Held-out Test Set")
plt.xticks(rotation=25, ha="right")
plt.yticks(rotation=0)
plt.tight_layout()

cm_path = OUTPUT_DIR / "confusion_matrix.png"
plt.savefig(cm_path, dpi=150)
plt.show()

# ============================================================
# 10. SAVE MODEL, CLASS ORDER AND METADATA
# ============================================================

# Save a plain state_dict to simplify later API loading.
torch.save(model.state_dict(), BEST_PATH)

with open(CLASS_PATH, "w", encoding="utf-8") as f:
    json.dump(class_names, f, indent=2)

metadata = {
    "architecture": "EfficientNet-B0",
    "framework": "PyTorch",
    "image_size": IMAGE_SIZE,
    "normalization_mean": [0.485, 0.456, 0.406],
    "normalization_std": [0.229, 0.224, 0.225],
    "class_names": class_names,
    "test_accuracy": float(test_accuracy),
    "train_images": len(train_set),
    "validation_images": len(val_set),
    "test_images": len(test_set),
    "random_seed": SEED,
    "dataset": "PlantVillage potato classes",
    "validation_note": (
        "Random stratified split; evaluate on independent field "
        "images before claiming real-world generalization."
    ),
}

with open(META_PATH, "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2)

print("\nTraining complete.")
print("Saved model:", BEST_PATH)
print("Saved class order:", CLASS_PATH)
print("Saved metadata:", META_PATH)
print("Saved confusion matrix:", cm_path)
