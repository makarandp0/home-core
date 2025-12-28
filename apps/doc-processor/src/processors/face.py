"""Face recognition processor using InsightFace with buffalo_l model."""

from __future__ import annotations

import base64
import io
import time

import cv2
import numpy as np
from PIL import Image

from . import face_cache

# Global FaceAnalysis instance - loaded on demand
_fa = None
_model_name: str | None = None

# Supported models
SUPPORTED_MODELS = ("buffalo_l", "buffalo_s")
DEFAULT_MODEL = "buffalo_l"


def load_model(model: str = DEFAULT_MODEL) -> None:
    """
    Load a face analysis model on demand.

    Models are downloaded on first use (not baked into Docker image).

    Args:
        model: Model name to load. Options:
            - "buffalo_l" (large, ~1.5GB, more accurate) - default
            - "buffalo_s" (small, ~500MB, faster)

    Raises:
        ValueError: If model name is not supported
    """
    global _fa, _model_name

    if model not in SUPPORTED_MODELS:
        raise ValueError(f"Unsupported model: {model}. Supported: {SUPPORTED_MODELS}")

    # Skip if same model already loaded
    if _fa is not None and _model_name == model:
        return

    # Unload existing model if switching
    if _fa is not None:
        _fa = None
        _model_name = None

    from insightface.app import FaceAnalysis

    fa = FaceAnalysis(name=model)
    # ctx_id=0 means CPU on onnxruntime
    fa.prepare(ctx_id=0, det_size=(640, 640))
    _fa = fa
    _model_name = model


def get_model_info() -> dict:
    """Return current model loading status."""
    return {
        "loaded": _fa is not None,
        "model": _model_name,
    }


def _to_bgr(image_b64: str) -> np.ndarray:
    """Convert base64-encoded image to BGR numpy array."""
    raw = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(img)  # RGB
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    return bgr


def embed(image_b64: str, use_cache: bool = True) -> tuple[np.ndarray | None, dict]:
    """
    Generate face embedding from image.

    Returns (embedding, meta). If no face found, embedding is None.
    Picks the largest detected face if multiple present.

    Args:
        image_b64: Base64-encoded image
        use_cache: Whether to use cache for embeddings (default: True)

    Raises:
        RuntimeError: If model is not loaded
    """
    if _fa is None:
        raise RuntimeError("Face model not loaded. Call load_model() first.")

    # Try cache first
    if use_cache:
        cache_key = face_cache.get_cache_key(image_b64, _model_name)
        cached = face_cache.cache_get(cache_key)
        if cached is not None:
            embedding, meta = cached
            meta["cached"] = True
            return embedding, meta

    # Cache miss or cache disabled - compute embedding
    bgr = _to_bgr(image_b64)
    faces = _fa.get(bgr)
    if not faces:
        return None, {"faces": 0, "cached": False}

    # Choose the largest face by bounding box area
    def _area(face) -> float:
        x1, y1, x2, y2 = face.bbox.astype(int)
        return float((x2 - x1) * (y2 - y1))

    best = max(faces, key=_area)
    vec = np.array(best.normed_embedding, dtype=np.float32)
    meta = {
        "faces": len(faces),
        "bbox": best.bbox.astype(float).tolist(),
        "det_score": float(getattr(best, "det_score", 0.0)),
        "cached": False,
    }

    # Store in cache
    if use_cache:
        face_cache.cache_set(cache_key, vec, meta)

    return vec, meta


def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """
    Calculate cosine distance between two embeddings.

    a and b expected normalized (insightface provides normed_embedding).
    Returns distance in [0, 2] where 0 is identical, 2 is opposite.
    """
    sim = float(np.dot(a, b))  # cosine similarity in [-1, 1]
    return 1.0 - sim


def compare(a_b64: str, b_b64: str, use_cache: bool = True) -> tuple[float | None, dict]:
    """
    Compare two face images and return cosine distance.

    Args:
        a_b64: Base64-encoded first image
        b_b64: Base64-encoded second image
        use_cache: Whether to use cache for embeddings (default: True)

    Returns:
        Tuple of (distance, metadata) where metadata includes timing and cache info

    Raises:
        RuntimeError: If model is not loaded
    """
    if _fa is None:
        raise RuntimeError("Face model not loaded. Call load_model() first.")

    start_time = time.time()

    ea, meta_a = embed(a_b64, use_cache=use_cache)
    if ea is None:
        return None, {"error": "no face in A", **meta_a}
    eb, meta_b = embed(b_b64, use_cache=use_cache)
    if eb is None:
        return None, {"error": "no face in B", **meta_b}
    dist = cosine_distance(ea, eb)

    elapsed_ms = (time.time() - start_time) * 1000

    return dist, {
        "a": meta_a,
        "b": meta_b,
        "timing_ms": round(elapsed_ms, 2),
        "model": _model_name,
        "cache_used": use_cache,
        "both_cached": meta_a.get("cached", False) and meta_b.get("cached", False),
    }


def get_cache_info() -> dict:
    """Return cache statistics and configuration."""
    return face_cache.get_cache_info()


def clear_cache() -> dict:
    """Clear all cached embeddings."""
    return face_cache.clear_cache()
