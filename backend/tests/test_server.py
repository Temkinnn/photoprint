import unittest
import os
import sys
from fastapi.testclient import TestClient
from main import app
from app.config import settings
from app.db.session import engine, SessionLocal
from app.db.models import DBUser, DBTask, DBDocument, DBMeeting, DBKPIMetric

class TestServerPostgres(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_database_is_postgresql(self):
        """Проверка, что база данных — строго PostgreSQL, без SQLite"""
        self.assertIn("postgresql", settings.DATABASE_URL)
        self.assertNotIn("sqlite", settings.DATABASE_URL)
        with engine.connect() as conn:
            res = conn.exec_driver_sql("SELECT version();").scalar()
            self.assertIn("PostgreSQL", res)

    def test_root_endpoint_metadata(self):
        """Проверка версии Python 3.12.10 и типа БД в корневом эндпоинте"""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["python_version"], "3.12.10")
        self.assertEqual(data["database_type"], "PostgreSQL")

    def test_auth_users_and_roles(self):
        """Проверка ролевой модели и получения списка пользователей"""
        res = self.client.get("/api/v1/auth/users")
        self.assertEqual(res.status_code, 200)
        users = res.json()
        self.assertEqual(len(users), 3)
        roles = {u["role"] for u in users}
        self.assertEqual(roles, {"ROLE_DIRECTOR", "ROLE_PRODUCTION_HEAD", "ROLE_SUPPORT_HEAD"})

    def test_tasks_crud_in_postgres(self):
        """Проверка CRUD операций с задачами и их сохранения в PostgreSQL"""
        res = self.client.get("/api/v1/tasks/")
        self.assertEqual(res.status_code, 200)
        tasks = res.json()
        self.assertGreaterEqual(len(tasks), 6)

        first_task = tasks[0]
        update_res = self.client.patch(f"/api/v1/tasks/{first_task['id']}", json={"status": "completed"})
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["status"], "completed")

        with SessionLocal() as db:
            db_task = db.query(DBTask).filter_by(id=first_task["id"]).first()
            self.assertIsNotNone(db_task)
            self.assertEqual(db_task.status, "completed")

    def test_rag_rbac_filtering(self):
        """Проверка разграничения прав доступа к документам (RBAC)"""
        self.client.post("/api/v1/auth/switch-role", json={"role": "ROLE_DIRECTOR"})
        res_dir = self.client.get("/api/v1/rag/documents")
        self.assertEqual(res_dir.status_code, 200)
        self.assertEqual(len(res_dir.json()), 16)

        self.client.post("/api/v1/auth/switch-role", json={"role": "ROLE_SUPPORT_HEAD"})
        res_sup = self.client.get("/api/v1/rag/documents")
        self.assertEqual(res_sup.status_code, 200)
        for doc in res_sup.json():
            self.assertGreaterEqual(doc["minClearance"], 3)

    def test_reset_demo_restores_database(self):
        """Проверка функции сброса демонстрационного стенда"""
        res = self.client.post("/api/v1/system/reset-demo")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "success")

        with SessionLocal() as db:
            tasks_count = db.query(DBTask).count()
            self.assertEqual(tasks_count, 6)
            users_count = db.query(DBUser).count()
            self.assertEqual(users_count, 3)
            docs_count = db.query(DBDocument).count()
            self.assertEqual(docs_count, 16)

    def test_agenda_generation(self):
        """Проверка генерации повестки и вопросов локальным/удаленным AI-модулем"""
        res = self.client.post("/api/v1/meetings/generate-agenda", json={
            "topic": "Тестовое совещание по ламинации",
            "participants": ["Смирнов А.В.", "Иванов И.С."],
            "documents": ["Технологическая карта"]
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("agenda", data)
        self.assertIn("openQuestions", data)
        self.assertTrue(len(data["agenda"]) >= 1)

    def test_process_audio_endpoint(self):
        """Проверка эндпоинта загрузки и анализа аудиофайла"""
        import io
        audio_stream = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
        res = self.client.post(
            "/api/v1/meetings/process-audio",
            files={"file": ("meeting_sample.wav", audio_stream, "audio/wav")},
            data={"title": "Тестовая встреча по звукозаписи"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("decisions", data)
        self.assertIn("tasks", data)
        self.assertIn("summary", data)
        self.assertIn("transcriptId", data)

    def test_create_and_delete_meeting(self):
        """Проверка создания и отмены встречи с динамической проверкой слотов календаря"""
        create_res = self.client.post("/api/v1/meetings/create", json={
            "title": "Тест календаря",
            "date": "2026-11-13",
            "time": "10:00 - 11:00",
            "durationMinutes": 60,
            "participants": ["Смирнов А.В."],
            "agenda": ["Пункт 1"]
        })
        self.assertEqual(create_res.status_code, 200)
        meeting_id = create_res.json()["id"]

        # Проверка слота: должен стать занятым
        slots_res = self.client.get("/api/v1/meetings/calendar/slots?date=2026-11-13")
        self.assertEqual(slots_res.status_code, 200)
        slot_10 = next((s for s in slots_res.json() if s["startTime"] == "10:00"), None)
        self.assertIsNotNone(slot_10)
        self.assertFalse(slot_10["isAvailable"])

        # Удаление встречи
        del_res = self.client.delete(f"/api/v1/meetings/{meeting_id}")
        self.assertEqual(del_res.status_code, 200)

if __name__ == "__main__":
    unittest.main()
