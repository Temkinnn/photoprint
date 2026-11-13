import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ENV_PATH = BACKEND_DIR / ".env"
ENV_EXAMPLE_PATH = BACKEND_DIR / ".env.example"

DEFAULT_ENV_CONTENT = """POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgrespassword
POSTGRES_SERVER=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=photoprint

AI_MODE=auto
AI_SERVER_URL=
LOCAL_AI_SERVER_URL=http://127.0.0.1:8001
WHISPER_MODEL_SIZE=medium

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBED_MODEL=bge-m3
OLLAMA_TIMEOUT_SECONDS=120.0
ALLOW_FALLBACK=false
"""


def ensure_env_file() -> None:
    if ENV_PATH.exists():
        return
    if ENV_EXAMPLE_PATH.exists():
        ENV_PATH.write_text(ENV_EXAMPLE_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        ENV_PATH.write_text(DEFAULT_ENV_CONTENT, encoding="utf-8")


def read_env_var(key: str) -> str:
    if not ENV_PATH.exists():
        return ""
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        k, v = stripped.split("=", 1)
        if k.strip() == key:
            val = v.strip()
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            return val.strip()
    return ""


def update_env_vars(updates: dict[str, str]) -> None:
    ensure_env_file()
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    remaining = dict(updates)
    new_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            new_lines.append(line)
            continue
        k, _ = stripped.split("=", 1)
        key_name = k.strip()
        if key_name in remaining:
            new_lines.append(f"{key_name}={remaining.pop(key_name)}")
        else:
            new_lines.append(line)

    if remaining:
        if new_lines and new_lines[-1].strip():
            new_lines.append("")
        for k, v in remaining.items():
            new_lines.append(f"{k}={v}")

    ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def normalize_url(raw_url: str) -> str:
    url = (raw_url or "").strip().strip("\"'").rstrip("/")
    if not url:
        return ""
    if not re.match(r"^https?://", url, flags=re.IGNORECASE):
        url = f"https://{url}"
    return url.rstrip("/")


def check_ai_health(base_url: str, timeout: float = 3.0) -> tuple[bool, str]:
    if not base_url:
        return False, "URL не задан"
    health_url = f"{base_url}/health"
    req = urllib.request.Request(
        health_url,
        headers={
            "Bypass-Tunnel-Reminder": "true",
            "User-Agent": "PhotoPrint-HealthCheck/1.0",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return False, f"HTTP {resp.status}"
            body = resp.read().decode("utf-8", errors="replace")
            data = json.loads(body)
            if data.get("status") == "online":
                model = data.get("ollama_model", "qwen2.5:7b")
                return True, f"online (модель: {model})"
            return False, f"некорректный статус: {data}"
    except urllib.error.HTTPError as exc:
        return False, f"HTTP {exc.code}"
    except Exception as exc:
        return False, str(exc)


def main() -> int:
    if os.name == "nt":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    ensure_env_file()
    current_url = normalize_url(read_env_var("AI_SERVER_URL"))

    if current_url:
        print(f"[*] Проверка удаленного AI-сервера: {current_url} ...")
        ok, info = check_ai_health(current_url)
        if ok:
            update_env_vars({"AI_MODE": "remote", "AI_SERVER_URL": current_url})
            print(f"[✓] AI-сервер активен ({info}). Продолжаем запуск без изменений.")
            return 0
        print(f"[!] Текущий AI-сервер недоступен ({info}).")
    else:
        print("[!] Адрес удаленного AI-сервера (AI_SERVER_URL) не задан в backend\\.env.")

    print()
    user_input = input(
        "Вставьте новую ссылку Cloudflare AI-сервера (или нажмите Enter для локального режима auto): "
    ).strip()

    new_url = normalize_url(user_input)
    if not new_url:
        update_env_vars({"AI_MODE": "auto", "AI_SERVER_URL": ""})
        print("[i] Включен локальный режим AI_MODE=auto (локальная Ollama / Whisper).")
        return 0

    print(f"[*] Проверка нового адреса {new_url} ...")
    ok, info = check_ai_health(new_url, timeout=5.0)
    if ok:
        print(f"[✓] Подключение подтверждено ({info})!")
    else:
        print(f"[!] Предупреждение: /health пока не ответил ({info}), но адрес сохранен в .env.")

    update_env_vars({"AI_MODE": "remote", "AI_SERVER_URL": new_url})
    print(f"[✓] Обновлен backend\\.env -> AI_SERVER_URL={new_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())