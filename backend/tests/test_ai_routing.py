import os
import sys
from unittest.mock import patch
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app
from app.config import settings
from app.services import meeting_analyzer, ollama_client


class _FakeHttpResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self):
        return self._payload


def test_auto_ai_routing_local_and_remote_fallback():
    orig_mode = settings.AI_MODE
    orig_remote = settings.AI_SERVER_URL
    settings.AI_MODE = "auto"
    settings.AI_SERVER_URL = "https://remote-example.loca.lt"

    try:
        with TestClient(app) as client:
            # 1. Local Ollama READY -> ai-status reports local-ollama EVEN THOUGH AI_SERVER_URL is set
            async def fake_probe_local_ready(*args, **kwargs):
                return True, True, ["qwen2.5:7b", "bge-m3"], "qwen2.5:7b", None

            async def fake_probe_srv_down(*args, **kwargs):
                return False, None, "down"

            with (
                patch("app.routers.system.probe_local_ollama", side_effect=fake_probe_local_ready),
                patch("app.routers.system.probe_ai_server", side_effect=fake_probe_srv_down),
            ):
                res = client.get("/api/v1/system/ai-status")
                assert res.status_code == 200
                data = res.json()
                assert data["ollamaOnline"] is True
                assert data["aiMode"] == "local-ollama"
                assert data["configuredModel"] == "qwen2.5:7b"

            # Verify chat_with_ollama hits localhost Ollama (/api/chat) when local is ready
            called_urls = []

            class FakeAsyncClientLocal:
                def __init__(self, *args, **kwargs):
                    pass

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    pass

                async def post(self, url, json=None, headers=None, **kwargs):
                    called_urls.append(url)
                    return _FakeHttpResponse(200, {"message": {"content": "Локальный ответ Qwen"}})

            with (
                patch("app.services.ollama_client.probe_local_ollama", side_effect=fake_probe_local_ready),
                patch("app.services.ollama_client.httpx.AsyncClient", FakeAsyncClientLocal),
            ):
                import asyncio
                reply = asyncio.run(ollama_client.chat_with_ollama([{"role": "user", "content": "Привет"}]))
                assert reply == "Локальный ответ Qwen"
                assert called_urls[-1].endswith("/api/chat")

            # 2. Local Ollama OFFLINE -> ai-status and chat_with_ollama fall back to AI_SERVER_URL
            async def fake_probe_local_down(*args, **kwargs):
                return False, False, [], None, "connection refused"

            async def fake_probe_srv_switch(base_url, *args, **kwargs):
                if "remote-example.loca.lt" in base_url:
                    return True, {"status": "online", "ollama_model": "qwen2.5:7b"}, None
                return False, None, "down"

            with (
                patch("app.routers.system.probe_local_ollama", side_effect=fake_probe_local_down),
                patch("app.routers.system.probe_ai_server", side_effect=fake_probe_srv_switch),
            ):
                res_remote = client.get("/api/v1/system/ai-status")
                assert res_remote.status_code == 200
                data_remote = res_remote.json()
                assert data_remote["ollamaOnline"] is True
                assert data_remote["aiMode"] == "remote-ai-server"

            remote_urls = []

            class FakeAsyncClientRemote:
                def __init__(self, *args, **kwargs):
                    pass

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    pass

                async def post(self, url, json=None, headers=None, **kwargs):
                    remote_urls.append((url, headers))
                    return _FakeHttpResponse(200, {"response": "Удаленный ответ AI"})

            with (
                patch("app.services.ollama_client.probe_local_ollama", side_effect=fake_probe_local_down),
                patch("app.services.ollama_client.probe_ai_server", side_effect=fake_probe_srv_switch),
                patch("app.services.ollama_client.httpx.AsyncClient", FakeAsyncClientRemote),
            ):
                import asyncio
                reply_remote = asyncio.run(ollama_client.chat_with_ollama([{"role": "user", "content": "Привет"}]))
                assert reply_remote == "Удаленный ответ AI"
                assert remote_urls[-1][0] == "https://remote-example.loca.lt/api/v1/ai/generate"
                assert remote_urls[-1][1].get("Bypass-Tunnel-Reminder") == "true"

            # 3. Local faster-whisper + local Ollama works without ai/server.py
            with (
                patch("app.services.meeting_analyzer.probe_ai_server", side_effect=fake_probe_srv_down),
                patch("app.services.meeting_analyzer.importlib.util.find_spec", return_value=object()),
                patch("app.services.meeting_analyzer._transcribe_with_local_faster_whisper", return_value="[00:05] Решили запустить смену"),
                patch("app.services.meeting_analyzer.probe_local_ollama", side_effect=fake_probe_local_ready),
                patch(
                    "app.services.meeting_analyzer.chat_with_ollama",
                    return_value='{"summary":"Кратко","decisions":[],"risks":[],"open_questions":[],"tasks":[]}',
                ),
            ):
                import asyncio
                proto = asyncio.run(meeting_analyzer.process_meeting_audio(b"RIFF0000", "test.wav", "Тест аудио"))
                assert "local faster-whisper" in (proto.modelUsed or "")

        print("AI_AUTO_ROUTING_PASSED")
    finally:
        settings.AI_MODE = orig_mode
        settings.AI_SERVER_URL = orig_remote


if __name__ == "__main__":
    test_auto_ai_routing_local_and_remote_fallback()
