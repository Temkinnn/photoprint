import os
import re
import uuid
from pathlib import Path

# backend/app/services/audio_storage.py -> поднимаемся на 3 уровня до backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]
AUDIO_UPLOAD_DIR = BACKEND_ROOT / "uploads" / "audio"


def ensure_audio_dir() -> Path:
    AUDIO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return AUDIO_UPLOAD_DIR


def save_uploaded_audio(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    """
    Сохраняет аудиофайл в backend/uploads/audio/ с уникальным именем.
    Возвращает кортеж (saved_filename, public_audio_url).
    """
    ensure_audio_dir()
    ext = os.path.splitext(original_filename or "")[1].lower()
    if not ext or not re.match(r"^\.[a-z0-9]{1,8}$", ext):
        ext = ".ogg"

    unique_name = f"{uuid.uuid4().hex}{ext}"
    target_path = AUDIO_UPLOAD_DIR / unique_name
    target_path.write_bytes(file_bytes)

    return unique_name, f"/api/v1/meetings/audio/{unique_name}"


def resolve_audio_path(filename: str) -> Path:
    """Безопасно резолвит путь к аудиофайлу внутри AUDIO_UPLOAD_DIR (защита от path traversal)."""
    safe_name = os.path.basename(filename)
    if safe_name != filename or not safe_name:
        raise ValueError("Некорректное имя аудиофайла")
    return ensure_audio_dir() / safe_name