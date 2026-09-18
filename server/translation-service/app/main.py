"""FastAPI entrypoint for the offline translation service."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .engine import TranslationEngine

logging.basicConfig(level=os.getenv("TRANSLATE_LOG_LEVEL", "INFO"))
LOGGER = logging.getLogger(__name__)
ENGINE: Optional[Any] = None
API_KEY = os.getenv("TRANSLATE_API_KEY", "")


class TranslateRequest(BaseModel):
    q: Optional[str] = None
    text: Optional[str] = None
    source: str = "auto"
    target: str = "auto"
    glossary: dict[str, str] = Field(default_factory=dict)
    preserve: list[str] = Field(default_factory=list)


def create_engine() -> TranslationEngine:
    return TranslationEngine(
        model_dir=os.getenv("TRANSLATE_MODEL_DIR", "./models/m2m100-418m-ct2-int8"),
        device=os.getenv("TRANSLATE_DEVICE", "cpu"),
        compute_type=os.getenv("TRANSLATE_COMPUTE_TYPE", "int8"),
        inter_threads=int(os.getenv("TRANSLATE_INTER_THREADS", "1")),
        intra_threads=int(os.getenv("TRANSLATE_INTRA_THREADS", "0")),
        cache_size=int(os.getenv("TRANSLATE_CACHE_SIZE", "2048")),
        max_chunk_chars=int(os.getenv("TRANSLATE_MAX_CHUNK_CHARS", "320")),
    )


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid API key")


def create_app(engine: Optional[Any] = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        global ENGINE
        app.state.engine = engine or create_engine()
        LOGGER.info("translation service ready")
        yield
        app.state.engine = None

    app = FastAPI(title="Offline M2M100 Translation Service", version="1.0.0", lifespan=lifespan)
    allowed_origins = [origin.strip() for origin in os.getenv("TRANSLATE_ALLOWED_ORIGINS", "*").split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins or ["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    async def run_translation(request: TranslateRequest) -> dict:
        text = request.q if request.q is not None else request.text
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="q or text is required")
        try:
            result = await run_in_threadpool(
                app.state.engine.translate,
                text,
                request.source,
                request.target,
                request.glossary,
                request.preserve,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return {
            "data": result.text,
            "text": result.text,
            "source": result.source,
            "target": result.target,
            "engine": "m2m100-418m-ct2-int8",
            "cached": result.cached,
            "elapsed_ms": result.elapsed_ms,
            "protected_count": getattr(result, "protected_count", 0),
        }

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", **(app.state.engine.health() if app.state.engine else {})}

    @app.get("/translate", dependencies=[Depends(require_api_key)])
    async def translate_get(
        q: str = Query(..., min_length=1),
        source: str = "auto",
        target: str = "auto",
    ) -> dict:
        return await run_translation(TranslateRequest(q=q, source=source, target=target))

    @app.post("/translate", dependencies=[Depends(require_api_key)])
    async def translate_post(request: TranslateRequest) -> dict:
        return await run_translation(request)

    @app.get("/", dependencies=[Depends(require_api_key)])
    async def root() -> dict:
        return {"name": "offline-m2m100-translation", "docs": "/docs", "translate": "/translate"}

    return app


app = create_app()
