import os
import sys
import time
import json

# Перенаправляем все загрузки моделей HuggingFace / Whisper строго на диск D:
os.environ["HF_HOME"] = "D:\\huggingface"
WHISPER_DOWNLOAD_ROOT = "D:\\whisper_models"

# Автоматическое подключение CUDA DLL (если установлены пакеты nvidia-*-cu12)
try:
    site_packages = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".venv", "Lib", "site-packages")
    for nvd in ["cublas", "cudnn"]:
        p = os.path.join(site_packages, "nvidia", nvd, "bin")
        if os.path.exists(p):
            os.add_dll_directory(p)
except Exception:
    pass

import numpy as np
import scipy.io.wavfile as wavfile
from openai import OpenAI
from typing import List, Optional

# Определение рабочей директории ai/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Подключение к локальной Ollama
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"
)
MODEL_NAME = "qwen2.5:7b"

# Корпоративный контекстный словарь для Whisper (исправляет фонетические ошибки)
CORPORATE_PROMPT = (
    "Оперативное производственное совещание руководства компании ООО «Фотопринт» (сервис picPac.by). "
    "Участники: Генеральный директор Смирнов, начальник производства Иванов, служба снабжения Петрова, служба поддержки Ковалева. "
    "Термины и оборудование: линия УФ-лакировки, ламинатор Foliant Vega 400, перенастройка станка, "
    "матовая бумага 200 грамм, поставщик, предоплата 50%, регламент 30%, лимит, ночная смена на резке, "
    "запасной комплект нагревательных элементов, срыв сроков клиентских заказов, SLA."
)


# ==========================================
# 0. УТИЛИТА ЗАГРУЗКИ АУДИО (БЕЗ PyAV ОШИБОК)
# ==========================================
def load_audio_as_numpy(audio_path, target_sr=16000):
    sr, data = wavfile.read(audio_path)
    if len(data.shape) > 1:
        data = data.mean(axis=1)

    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2147483648.0
    elif data.dtype == np.uint8:
        data = (data.astype(np.float32) - 128.0) / 128.0
    else:
        data = data.astype(np.float32)

    if sr != target_sr:
        from scipy import signal
        num_samples = int(len(data) * target_sr / sr)
        data = signal.resample(data, num_samples)

    return data


# ==========================================
# 1. ЗАПИСЬ АУДИО С МИКРОФОНА
# ==========================================
def record_audio(output_filename="meeting.wav", sample_rate=16000):
    try:
        import sounddevice as sd
    except ImportError:
        print("[!] Для записи с микрофона установите: pip install sounddevice scipy numpy")
        sys.exit(1)

    full_output_path = os.path.join(BASE_DIR, output_filename)

    print("\n" + "="*50)
    print("      ГОЛОСОВАЯ ЗАПИСЬ ДИАЛОГА СОВЕЩАНИЯ")
    print("="*50)
    input("Нажмите [ENTER], чтобы НАЧАТЬ запись с микрофона...")

    print("[● ИДЕТ ЗАПИСЬ...] Говорите в микрофон (вы и коллега).")
    print("Нажмите [ENTER] еще раз, чтобы ОСТАНОВИТЬ запись...")

    recording = []
    def callback(indata, frames, time_info, status):
        recording.append(indata.copy())

    with sd.InputStream(samplerate=sample_rate, channels=1, callback=callback, dtype='float32'):
        input()

    print("[*] Запись остановлена. Сохранение файла...")
    audio_data = np.concatenate(recording, axis=0)
    audio_int16 = (audio_data * 32767).astype(np.int16)
    wavfile.write(full_output_path, sample_rate, audio_int16)
    print(f"[✓] Аудиозапись сохранена: {full_output_path}")
    return full_output_path


# ==========================================
# 2. РАСПОЗНАВАНИЕ РЕЧИ (STT: faster-whisper)
# ==========================================
def transcribe_audio(audio_path="meeting.wav", model_size="medium"):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("[!] Для распознавания установите: pip install faster-whisper")
        sys.exit(1)

    if not os.path.isabs(audio_path):
        audio_path = os.path.join(BASE_DIR, audio_path)

    print(f"\n[*] Загрузка аудио: '{audio_path}'...")
    audio_numpy = load_audio_as_numpy(audio_path, target_sr=16000)

    def try_decode(m_size, device, compute_type):
        m = WhisperModel(m_size, device=device, compute_type=compute_type, download_root=WHISPER_DOWNLOAD_ROOT)
        # Передаем initial_prompt со словарем типографии для идеальной точности!
        segs, _ = m.transcribe(
            audio_numpy,
            beam_size=5,
            language="ru",
            initial_prompt=CORPORATE_PROMPT,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400)
        )
        return list(segs)

    print(f"[*] Инициализация faster-whisper (модель: {model_size})...")
    segments = None
    
    # Сначала пробуем medium на GPU -> потом medium на CPU -> при нехватке памяти small
    for current_model in [model_size, "small"]:
        try:
            segments = try_decode(current_model, "cuda", "float16")
            print(f"[✓] Распознавание выполнено на GPU (CUDA, модель: {current_model})")
            break
        except Exception:
            try:
                segments = try_decode(current_model, "cpu", "int8")
                print(f"[✓] Распознавание выполнено на CPU (int8, модель: {current_model})")
                break
            except Exception as e_cpu:
                if current_model == "small":
                    print(f"[!] Критическая ошибка транскрибации: {e_cpu}")
                    sys.exit(1)
                print(f"[!] Не удалось загрузить модель {current_model}, пробуем облегченную small...")

    formatted_transcript = []
    print("\n" + "-"*50)
    print("  РАСШИФРОВКА РЕЧИ С ТАЙМКОДАМИ:")
    print("-" * 50)

    for segment in segments:
        start_min = int(segment.start // 60)
        start_sec = int(segment.start % 60)
        time_tag = f"[{start_min:02d}:{start_sec:02d}]"
        line = f"{time_tag} {segment.text.strip()}"
        print(line)
        formatted_transcript.append(line)

    full_text = "\n".join(formatted_transcript)
    return full_text


# ==========================================
# 3. АНАЛИЗ И ДИАРИЗАЦИЯ СПИКЕРОВ ЧЕРЕЗ QWEN
# ==========================================
def analyze_and_diarize_with_llm(transcript_text: str):
    print(f"\n[*] Передаем стенограмму в Qwen 2.5 ({MODEL_NAME}) для диаризации спикеров и извлечения задач...")

    system_prompt = """
    Ты — ведущий AI-ассистент генерального директора производственной компании ООО «Фотопринт».
    Перед тобой сырая текстовая стенограмма совещания с таймкодами.

    Твоя задача — выполнить ДВА действия:

    ДЕЙСТВИЕ 1: РАЗДЕЛЕНИЕ ПО СПИКЕРАМ (Diarization)
    По смыслу реплик и обращениям определи говорящего для КАЖДОЙ строки:
    - «Директор (Смирнов)» — открывает встречу, раздает поручения («Принято», «Пусть Петрова...», «Что по готовности?»).
    - «Иванов (Нач. производства)» — отвечает по оборудованию («Я закончу перенастройку...», «не хватит людей на резке»).
    - «Петрова / Иванов (Снабжение)» — говорит про поставщиков и лимиты предоплаты бумаги.
    Запиши список diarized_lines: для каждой строки верни: timestamp, speaker, text (исправь опечатки распознавания, если смысл очевиден: например, "фотопринц" -> "Фотопринт", "старшик" -> "поставщик", "предокладка" -> "предоплата").

    ДЕЙСТВИЕ 2: ИЗВЛЕЧЕНИЕ ЗАДАЧ И РЕШЕНИЙ ПО ТЗ
    1. decisions (Список решений):
       - category: строго одно из: "решено", "предложено", "обсуждалось", "требует уточнения"
       - text: формулировка решения
       - speaker: кто озвучил/утвердил
       - timestamp: таймкод
    2. tasks (Реестр поручений / Action Items):
       - temp_id: порядковый номер (t1, t2...)
       - title: действие с глаголом в инфинитиве (например: "Перенастроить линию УФ-лакировки")
       - assignee: ФИО или должность. ПРАВИЛО AI-05: Если исполнитель не назван явно — строго пиши: "требует уточнения" (НЕ ВЫДУМЫВАЙ!).
       - deadline: конкретный срок. ПРАВИЛО AI-05: Если срок не назван — строго пиши: "требует уточнения" (НЕ ВЫДУМЫВАЙ!).
       - source_quote: точная цитата фразы
       - timestamp: таймкод фразы
       - status: "pending_approval"
    3. identified_risks: обнаруженные производственные/бизнес риски.
    4. open_questions: темы или вопросы, отложенные на будущее.

    Ответ верни СТРОГО в виде JSON:
    {
      "diarized_lines": [{"timestamp": "[00:03]", "speaker": "...", "text": "..."}],
      "decisions": [{"category": "...", "text": "...", "speaker": "...", "timestamp": "..."}],
      "tasks": [{"temp_id": "...", "title": "...", "assignee": "...", "deadline": "...", "source_quote": "...", "timestamp": "...", "status": "pending_approval"}],
      "identified_risks": [{"risk": "..."}],
      "open_questions": [{"question": "..."}]
    }
    Никаких комментариев до и после JSON.
    """

    user_prompt = f"Сырая стенограмма совещания:\n{transcript_text}"

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,
        response_format={"type": "json_object"}
    )

    parsed = json.loads(response.choices[0].message.content)
    return parsed


# ==========================================
# 4. ГЕНЕРАЦИЯ WORD-ДОКУМЕНТА С ДИАРИЗАЦИЕЙ
# ==========================================
def create_word_protocol(analysis: dict, output_docx="Протокол_совещания_Фотопринт.docx"):
    try:
        from docx import Document
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_COLOR_INDEX
        from docx.enum.table import WD_TABLE_ALIGNMENT
        from docx.oxml import parse_xml
        from docx.oxml.ns import nsdecls
    except ImportError:
        print("[!] Для генерации Word установите: pip install python-docx")
        sys.exit(1)

    full_docx_path = os.path.join(BASE_DIR, output_docx)
    print(f"\n[*] Формируем официальный Word-документ: {full_docx_path}...")
    doc = Document()

    # Поля страницы 2 см
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # 1. Шапка документа
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = title.add_run("ООО «ФОТОПРИНТ» (picPac.by)")
    r_title.font.name = "Arial"
    r_title.font.size = Pt(16)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(31, 78, 121)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = sub.add_run("ПРОТОКОЛ ОПЕРАТИВНОГО СОВЕЩАНИЯ РУКОВОДСТВА")
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(13)
    r_sub.font.bold = True

    meta_p = doc.add_paragraph()
    meta_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_date = meta_p.add_run(f"Дата фиксации: {time.strftime('%d.%m.%Y %H:%M')}\nСтатус протокола: Предварительный (Draft & Review)")
    r_date.font.name = "Arial"
    r_date.font.size = Pt(9)
    r_date.font.italic = True

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    def add_section_header(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(4)
        r = h.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = RGBColor(31, 78, 121)

    # 2. РЕЕСТР ПОРУЧЕНИЙ И ЗАДАЧ (AI-04, AI-05)
    add_section_header("1. РЕЕСТР ПОРУЧЕНИЙ И ДЕЛЕГИРОВАННЫХ ЗАДАЧ")
    tasks = analysis.get("tasks", [])
    
    if tasks:
        table = doc.add_table(rows=1, cols=5)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        hdr_cells = table.rows[0].cells
        headers = ["№", "Формулировка поручения", "Ответственный", "Срок исполнения", "Таймкод и основание"]
        
        for i, header_text in enumerate(headers):
            hdr_cells[i].text = header_text
            shading_elm = parse_xml(r'<w:shd {} w:fill="EBF1F5"/>'.format(nsdecls('w')))
            hdr_cells[i]._tc.get_or_add_tcPr().append(shading_elm)
            p = hdr_cells[i].paragraphs[0]
            p.runs[0].font.bold = True
            p.runs[0].font.size = Pt(9.5)
            p.runs[0].font.name = "Arial"

        for idx, t in enumerate(tasks, start=1):
            row_cells = table.add_row().cells
            row_cells[0].text = str(idx)
            row_cells[1].text = t.get("title", "")
            
            # Ответственный (с проверкой AI-05)
            assignee = t.get("assignee", "требует уточнения")
            row_cells[2].text = assignee
            if "требует уточнения" in assignee.lower():
                row_cells[2].paragraphs[0].runs[0].font.highlight_color = WD_COLOR_INDEX.YELLOW

            # Срок (с проверкой AI-05)
            deadline = t.get("deadline", "требует уточнения")
            row_cells[3].text = deadline
            if "требует уточнения" in deadline.lower():
                row_cells[3].paragraphs[0].runs[0].font.highlight_color = WD_COLOR_INDEX.YELLOW

            # Основание и таймкод
            quote = t.get("source_quote", "")
            time_tag = t.get("timestamp", "")
            row_cells[4].text = f"{time_tag} «{quote}»"

            for cell in row_cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        r.font.name = "Arial"
                        r.font.size = Pt(9)
    else:
        doc.add_paragraph("Явных задач в ходе совещания зафиксировано не было.")

    # 3. КЛЮЧЕВЫЕ РЕШЕНИЯ (4 СТАТУСА)
    add_section_header("2. КЛЮЧЕВЫЕ РЕШЕНИЯ И ХОД ОБСУЖДЕНИЯ (4 СТАТУСА)")
    decisions = analysis.get("decisions", [])
    if decisions:
        for d in decisions:
            cat = d.get("category", "обсуждалось")
            text = d.get("text", "")
            speaker = d.get("speaker", "")
            ts = d.get("timestamp", "")
            
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_after = Pt(3)
            
            r_cat = p.add_run(f"[{cat.upper()}] ")
            r_cat.font.name = "Arial"
            r_cat.font.bold = True
            r_cat.font.size = Pt(9.5)
            
            speaker_str = f" ({speaker}, {ts})" if speaker else f" ({ts})"
            if cat.lower() == "решено":
                r_cat.font.color.rgb = RGBColor(38, 128, 0)
                r_text = p.add_run(f"{text}{speaker_str}")
                r_text.font.highlight_color = WD_COLOR_INDEX.YELLOW
            elif cat.lower() == "требует уточнения":
                r_cat.font.color.rgb = RGBColor(200, 30, 30)
                p.add_run(f"{text}{speaker_str}")
            else:
                r_cat.font.color.rgb = RGBColor(80, 80, 80)
                p.add_run(f"{text}{speaker_str}")

    # 4. РИСКИ И ОТКРЫТЫЕ ВОПРОСЫ
    add_section_header("3. ОБНАРУЖЕННЫЕ РИСКИ И ПРЕДУПРЕЖДЕНИЯ")
    risks = analysis.get("identified_risks", [])
    if risks:
        for r in risks:
            p = doc.add_paragraph(style='List Bullet')
            r_run = p.add_run(f"⚠️ {r.get('risk', '')}")
            r_run.font.name = "Arial"
            r_run.font.size = Pt(9.5)
            r_run.font.highlight_color = WD_COLOR_INDEX.YELLOW
    else:
        doc.add_paragraph("Критических производственных рисков не выявлено.")

    add_section_header("4. ОТКРЫТЫЕ ВОПРОСЫ НА СЛЕДУЮЩУЮ ВСТРЕЧУ")
    open_q = analysis.get("open_questions", [])
    if open_q:
        for q in open_q:
            p = doc.add_paragraph(style='List Bullet')
            p.add_run(f"❓ {q.get('question', '')}")
    else:
        doc.add_paragraph("Открытых вопросов не зафиксировано.")

    # 5. СТЕНОГРАММА С РАЗМЕТКОЙ СПИКЕРОВ (ДИАРИЗАЦИЯ)
    add_section_header("5. ПОЛНАЯ СТЕНОГРАММА ВСТРЕЧИ (РАЗМЕТКА СПИКЕРОВ)")
    quotes_to_highlight = [t.get("source_quote", "").strip().lower() for t in tasks if t.get("source_quote")]
    diarized_lines = analysis.get("diarized_lines", [])

    if diarized_lines:
        for item in diarized_lines:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(2)

            ts = item.get("timestamp", "")
            speaker = item.get("speaker", "Участник")
            line_text = item.get("text", "")

            # Таймкод
            r_ts = p.add_run(f"{ts} ")
            r_ts.font.name = "Consolas"
            r_ts.font.size = Pt(8.5)
            r_ts.font.color.rgb = RGBColor(120, 120, 120)

            # Имя говорящего (синим жирным шрифтом)
            r_spk = p.add_run(f"{speaker}: ")
            r_spk.font.name = "Arial"
            r_spk.font.size = Pt(9)
            r_spk.font.bold = True
            r_spk.font.color.rgb = RGBColor(31, 78, 121)

            # Текст реплики с жёлтой подсветкой цитаты задачи
            r_txt = p.add_run(line_text)
            r_txt.font.name = "Arial"
            r_txt.font.size = Pt(9)
            r_txt.font.color.rgb = RGBColor(40, 40, 40)

            line_lower = line_text.lower()
            if any(q in line_lower for q in quotes_to_highlight if len(q) > 6):
                r_txt.font.highlight_color = WD_COLOR_INDEX.YELLOW

    doc.save(full_docx_path)
    print(f"\n[✓] Готово! Word-протокол успешно сохранен:\n    {full_docx_path}")
    return full_docx_path


# ==========================================
# ОСНОВНОЙ ВХОДНОЙ СЦЕНАРИЙ
# ==========================================
def main():
    print("=" * 60)
    print("   AI-АССИСТЕНТ РУКОВОДИТЕЛЯ: ГОЛОС -> ПРОТОКОЛ -> WORD")
    print("        ООО «ФОТОПРИНТ» (Апгрейд: Точность + Диаризация)")
    print("=" * 60)

    audio_file = "meeting.wav"
    full_audio_path = os.path.join(BASE_DIR, audio_file)
    has_recorded_file = os.path.exists(full_audio_path)

    print("\nВыберите способ ввода диалога:")
    if has_recorded_file:
        print(f"  [1] Использовать УЖЕ ЗАПИСАННЫЙ ранее голос ({audio_file})")
        print("  [2] Записать живой диалог с микрофона ЗАНОВО")
        print("  [3] Использовать тестовую текстовую стенограмму (без аудио)")
        choice = input("\nВаш выбор [1, 2 или 3] (по умолчанию 1): ").strip() or "1"
    else:
        print("  [1] Записать живой диалог с микрофона")
        print("  [2] Использовать готовый аудиофайл")
        print("  [3] Использовать тестовую текстовую стенограмму")
        choice = input("\nВаш выбор [1, 2 или 3] (по умолчанию 1): ").strip() or "1"

    transcript_text = ""
    if (has_recorded_file and choice == "1") or (not has_recorded_file and choice == "2"):
        transcript_text = transcribe_audio(audio_path=full_audio_path, model_size="medium")
    elif (has_recorded_file and choice == "2") or (not has_recorded_file and choice == "1"):
        full_audio_path = record_audio(output_filename=audio_file)
        transcript_text = transcribe_audio(audio_path=full_audio_path, model_size="medium")
    else:
        print("\n[*] Используем тестовую стенограмму планерки...")
        transcript_text = """[00:01] Директор: Коллеги, начинаем планерку по запуску фотокниг 20х20.
[00:12] Иванов (Нач. производства): Линию УФ-лакировки нужно перенастроить. Я лично закончу перенастройку до пятницы, 15 ноября.
[00:28] Директор: Отлично, фиксируем. Что со снабжением матовой бумагой?
[00:40] Петрова: Поставщик требует предоплату 50%, а у нас лимит 30%. Договор пока не подписан.
[00:55] Директор: Петрова, проведи повторные переговоры до четверга и согласуй лимит 30%.
[01:10] Иванов: При двукратном росте заказов возникнет дефицит людей в ночную смену на резке. Это серьезный риск срыва SLA.
[01:30] Директор: Вопрос ночной смены пока отложим, вернемся в понедельник после отчета маркетинга."""

    # Анализ и диаризация через локальный Qwen 2.5
    analysis = analyze_and_diarize_with_llm(transcript_text)

    # Генерация Word-документа с разделением по спикерам и желтой подсветкой
    docx_file = create_word_protocol(analysis)

    print("\n" + "="*60)
    print("🎉 ВСЯ ЦЕПОЧКА УСПЕШНО ЗАВЕРШЕНА!")
    print(f"📄 Файл протокола сохранен в ai/: {docx_file}")
    print("="*60)

    # Открытие Word
    try:
        os.startfile(docx_file)
    except Exception:
        pass


if __name__ == "__main__":
    main()
