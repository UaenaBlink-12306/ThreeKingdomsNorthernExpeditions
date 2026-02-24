from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - optional during local bootstrap
    def load_dotenv(*_args, **_kwargs) -> bool:
        return False

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.api.routes import router

app = FastAPI(title="Three Kingdoms Northern Expedition MVP", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Development setting
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
