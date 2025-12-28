"""
Embedding cache management for face recognition.

Provides disk-based caching of face embeddings to avoid recomputation.
Cache keys are based on image hash and model name.
"""

from __future__ import annotations

import hashlib
import json
import pathlib

import numpy as np

# Cache configuration
CACHE_DIR = pathlib.Path(".cache/embeddings")
_cache_stats = {"hits": 0, "misses": 0, "stores": 0}


def get_cache_key(image_b64: str, model_name: str) -> str:
    """
    Generate cache key from image data and model name.

    Args:
        image_b64: Base64-encoded image
        model_name: Name of the model being used

    Returns:
        Cache key string in format "model:hash"
    """
    # Hash the base64 string directly (fast, deterministic)
    image_hash = hashlib.sha256(image_b64.encode()).hexdigest()
    # Include model name since different models produce different embeddings
    return f"{model_name}:{image_hash}"


def cache_get(key: str) -> tuple[np.ndarray, dict] | None:
    """
    Retrieve cached embedding and metadata.

    Args:
        key: Cache key

    Returns:
        Tuple of (embedding, metadata) or None if not found
    """
    cache_file = CACHE_DIR / f"{key}.json"
    if not cache_file.exists():
        _cache_stats["misses"] += 1
        return None

    try:
        data = json.loads(cache_file.read_text())
        embedding = np.array(data["embedding"], dtype=np.float32)
        _cache_stats["hits"] += 1
        return embedding, data["meta"]
    except (json.JSONDecodeError, KeyError, ValueError):
        # Corrupted cache file, ignore
        _cache_stats["misses"] += 1
        return None


def cache_set(key: str, embedding: np.ndarray, meta: dict) -> None:
    """
    Store embedding and metadata in cache.

    Args:
        key: Cache key
        embedding: Face embedding vector
        meta: Metadata dictionary
    """
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file = CACHE_DIR / f"{key}.json"
        cache_data = {
            "embedding": embedding.tolist(),
            "meta": meta,
        }
        cache_file.write_text(json.dumps(cache_data))
        _cache_stats["stores"] += 1
    except OSError:
        # Ignore cache write failures (e.g., disk full, permissions)
        pass


def get_cache_info() -> dict:
    """
    Return cache statistics and configuration.

    Returns:
        Dictionary with cache stats, size, and configuration
    """
    cache_size = 0
    cache_count = 0
    if CACHE_DIR.exists():
        cache_files = list(CACHE_DIR.glob("*.json"))
        cache_count = len(cache_files)
        cache_size = sum(f.stat().st_size for f in cache_files)

    total_requests = _cache_stats["hits"] + _cache_stats["misses"]
    hit_rate = (_cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0

    return {
        "enabled": True,
        "cache_dir": str(CACHE_DIR),
        "cached_embeddings": cache_count,
        "cache_size_bytes": cache_size,
        "cache_size_mb": round(cache_size / 1024 / 1024, 2),
        "stats": {
            "hits": _cache_stats["hits"],
            "misses": _cache_stats["misses"],
            "stores": _cache_stats["stores"],
            "hit_rate_percent": round(hit_rate, 1),
        },
    }


def clear_cache() -> dict:
    """
    Clear all cached embeddings.

    Returns:
        Dictionary with number of files deleted
    """
    deleted = 0
    if CACHE_DIR.exists():
        for cache_file in CACHE_DIR.glob("*.json"):
            try:
                cache_file.unlink()
                deleted += 1
            except OSError:
                pass

    # Reset stats
    _cache_stats["hits"] = 0
    _cache_stats["misses"] = 0
    _cache_stats["stores"] = 0

    return {"deleted": deleted}
