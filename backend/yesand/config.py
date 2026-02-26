"""Runtime configuration helpers that reflect live .env changes."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def _read_dotenv() -> dict[str, str]:
    if not ENV_PATH.exists():
        return {}
    return {
        key: value
        for key, value in dotenv_values(ENV_PATH).items()
        if value is not None and str(value).strip() != ""
    }


def get_env(key: str, default: str | None = None) -> str | None:
    values = _read_dotenv()
    if key in values:
        return values[key]
    return os.getenv(key, default)


def get_text_model(default: str) -> str:
    return get_env("OPENAI_TEXT_MODEL", default) or default


def get_image_model() -> str:
    return get_env("OPENAI_IMAGE_MODEL", "dall-e-2") or "dall-e-2"


def get_image_size() -> str:
    return get_env("OPENAI_IMAGE_SIZE", "1024x1024") or "1024x1024"


def get_image_quality() -> str:
    return get_env("OPENAI_IMAGE_QUALITY", "standard") or "standard"
