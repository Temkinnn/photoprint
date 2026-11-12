"""Изолированный воркер Whisper STT: после завершения выходит, полностью освобождая GPU VRAM для Qwen."""
import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Не передан путь к аудиофайлу"}, ensure_ascii=False))
        return 2

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "medium"

    from app.services.meeting_analyzer import _run_faster_whisper_on_path

    transcript = _run_faster_whisper_on_path(audio_path, model_size)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps({"transcript": transcript}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
