from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import REGISTRY_FILE


# =========================================================
# REGISTRY
# =========================================================

def load_registry() -> Dict[str, Any]:

    if not REGISTRY_FILE.exists():

        return {
            "datasets": []
        }

    try:

        return json.loads(
            REGISTRY_FILE.read_text(
                encoding="utf-8"
            )
        )

    except Exception:

        return {
            "datasets": []
        }


def save_registry(
    registry: Dict[str, Any],
):

    REGISTRY_FILE.write_text(
        json.dumps(
            registry,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )


# =========================================================
# ID
# =========================================================

def generate_dataset_id() -> str:

    return (
        "dataset-"
        + uuid.uuid4().hex[:12]
    )


# =========================================================
# ADD DATASET
# =========================================================

def add_dataset(
    dataset: Dict[str, Any],
) -> Dict[str, Any]:

    registry = load_registry()

    registry["datasets"].append(
        dataset
    )

    save_registry(
        registry
    )

    return dataset


# =========================================================
# ALL DATASETS
# =========================================================

def get_datasets() -> List[Dict[str, Any]]:

    registry = load_registry()

    return registry.get(
        "datasets",
        [],
    )


# =========================================================
# FIND DATASET
# =========================================================

def get_dataset(
    dataset_id: str,
) -> Optional[Dict[str, Any]]:

    datasets = get_datasets()

    for dataset in datasets:

        if dataset["id"] == dataset_id:

            return dataset

    return None


# =========================================================
# DELETE
# =========================================================

def delete_dataset(
    dataset_id: str,
) -> bool:

    registry = load_registry()

    datasets = registry.get(
        "datasets",
        [],
    )

    original_length = len(
        datasets
    )

    registry["datasets"] = [
        dataset
        for dataset in datasets
        if dataset["id"] != dataset_id
    ]

    if len(
        registry["datasets"]
    ) == original_length:

        return False

    save_registry(
        registry
    )

    return True