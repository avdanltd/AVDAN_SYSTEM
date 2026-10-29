"""Singleton fastembed embedder (ONNX-based, no PyTorch dependency).

Loaded lazily on first call so the FastAPI process stays fast to start.
The heavy load happens in the Celery worker, not the API server —
the API search endpoint generates the query embedding inline (fast, <10ms).
"""
from __future__ import annotations

import logging
from threading import Lock

logger = logging.getLogger(__name__)

_model = None
_lock = Lock()
_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_DIM = 384


def get_model() -> object:
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        try:
            from fastembed import TextEmbedding
            logger.info("Loading fastembed model %s", _MODEL_NAME)
            _model = TextEmbedding(model_name=_MODEL_NAME)
            logger.info("Model loaded")
        except ImportError:
            logger.warning("fastembed not installed — semantic search disabled")
            _model = None
    return _model


def encode(text: str) -> list[float] | None:
    model = get_model()
    if model is None:
        return None
    try:
        from fastembed import TextEmbedding
        m: TextEmbedding = model  # type: ignore[assignment]
        vectors = list(m.embed([text]))
        return vectors[0].tolist()
    except Exception as exc:
        logger.error("Embedding failed: %s", exc)
        return None


def dim() -> int:
    return _DIM
