import os
import sys
import time
import json
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


# ==========================================
# 1. ЗАПИСЬ АУДИО С МИКРОФОНА
# ==========================================
def record_audio(output_filename="meeting.wav", sample_rate=16000):
    try:
        import sounddevice as sd
        import scipy.io.wavfile as wavfile
        import numpy as np
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

    # Запускаем неблокирующий аудиопоток (моно, 16 кГц - стандарт для Whisper)
    with sd.InputStream(samplerate=sample_rate, channels=1, callback=callback, dtype='float32'):
        input()

    print("[*] Запись остановлена. Сохранение файла...")
    audio_data = np.concatenate(recording, axis=0)
    
    # Нормализация громкости и конвертация в 16-bit PCM WAV
    audio_int16 = (audio_data * 32767).astype(np.int16)
    wavfile.write(full_output_path, sample_rate, audio_int16)
    print(f"[✓] Аудиозапись сохранена: {full_output_path}")
    return full_output_path


# ==========================================
# 2. РАСПОЗНАВАНИЕ РЕЧИ (STT: faster-whisper)
# ==========================================
def transcribe_audio(audio_path="meeting.wav", model_size="small"):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("[!] Для распознавания установите: pip install faster-whisper")
        sys.exit(1)

    if not os.path.isabs(audio_path):
        audio_path = os.path.join(BASE_DIR, audio_path)

    print(f"\n[*] Инициализация faster-whisper (модель: {model_size})...")
    
    # Пробуем запустить на GPU (RTX 4050), если нет CUDA - переключаемся на CPU
    try:
        model = WhisperModel(model_size, device="cuda", compute_type="float16")
        print("[✓] Whisper запущен на GPU (CUDA float16)")
    except Exception as e:
        print(f"[!] Предупреждение: GPU CUDA не активна ({e}). Переключаемся на CPU...")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(f"[*] Идет расшифровка файла '{audio_path}'...")
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language="ru",
        vad_filter=True, # Фильтрация пауз и шума
        vad_parameters=dict(min_silence_duration_ms=500)
    )

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
# 3. АНАЛИЗ СТЕНОГРАММЫ ЧЕРЕЗ QWEN 2.5
# ==========================================
def analyze_with_llm(transcript_text: str):
    print(f"\n[*] Передаем стенограмму в Qwen 2.5 ({MODEL_NAME}) для извлечения решений и задач...")

    system_prompt = """
    Ты — ведущий AI-ассистент генерального директора производственной компании ООО «Фотопринт».
    Твоя задача — детально проанализировать стенограмму совещания и строго следовать правилам ТЗ:

    1. decisions (Список решений):
       - category: строго одно из четырех значений: "решено", "предложено", "обсуждалось", "требует уточнения"
       - text: четкая формулировка решения или обсуждаемого факта
       - timestamp: таймкод фразы из стенограммы

    2. tasks (Реестр поручений / Action Items):
       - temp_id: порядковый номер (t1, t2...)
       - title: действие с глаголом в инфинитиве (например: "Перенастроить линию УФ-лакировки")
       - assignee: ФИО или должность. ПРАВИЛО AI-05: Если исполнитель не назван явно, строго пиши: "требует уточнения" (НЕ ВЫДУМЫВАЙ!).
       - deadline: конкретный срок или дата. ПРАВИЛО AI-05: Если срок не назван, строго пиши: "требует уточнения" (НЕ ВЫДУМЫВАЙ!).
       - source_quote: дословная цитата фразы из стенограммы
       - timestamp: таймкод фразы (например: "[00:15]")
       - status: "pending_approval"

    3. identified_risks (Обнаруженные риски):
       - risk: описание риска и возможного негативного влияния

    4. open_questions (Открытые нерешенные вопросы):
       - question: тема или вопрос, отложенный на будущее

    Ответ верни СТРОГО в виде валидного JSON-объекта со структурой:
    {
      "decisions": [{"category": "...", "text": "...", "timestamp": "..."}],
      "tasks": [{"temp_id": "...", "title": "...", "assignee": "...", "deadline": "...", "source_quote": "...", "timestamp": "...", "status": "pending_approval"}],
      "identified_risks": [{"risk": "..."}],
      "open_questions": [{"question": "..."}]
    }
    Никаких комментариев до и после JSON.
    """

    user_prompt = f"Стенограмма совещания:\n{transcript_text}"

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
# 4. ГЕНЕРАЦИЯ WORD-ДОКУМЕНТА С ПОДСВЕТКОЙ
# ==========================================
def create_word_protocol(transcript_text: str, analysis: dict, output_docx="Протокол_совещания_Фотопринт.docx"):
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
    r_date = meta_p.add_run(f"Дата фиксации: {time.strftime('%d.%m.%2026 %H:%M')}\nСтатус протокола: Предварительный (Draft & Review)")
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
            ts = d.get("timestamp", "")
            
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_after = Pt(3)
            
            r_cat = p.add_run(f"[{cat.upper()}] ")
            r_cat.font.name = "Arial"
            r_cat.font.bold = True
            r_cat.font.size = Pt(9.5)
            
            if cat.lower() == "решено":
                r_cat.font.color.rgb = RGBColor(38, 128, 0)
                # Желтая подсветка утвержденного факта!
                r_text = p.add_run(f"{text} ({ts})")
                r_text.font.highlight_color = WD_COLOR_INDEX.YELLOW
            elif cat.lower() == "требует уточнения":
                r_cat.font.color.rgb = RGBColor(200, 30, 30)
                p.add_run(f"{text} ({ts})")
            else:
                r_cat.font.color.rgb = RGBColor(80, 80, 80)
                p.add_run(f"{text} ({ts})")

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

    # 5. ИСХОДНАЯ СТЕНОГРАММА С ПОДСВЕТКОЙ
    add_section_header("5. ПОЛНАЯ СТЕНОГРАММА ВСТРЕЧИ (С ПРИВЯЗКОЙ ОСНОВАНИЙ)")
    quotes_to_highlight = [t.get("source_quote", "").strip().lower() for t in tasks if t.get("source_quote")]
    
    for line in transcript_text.splitlines():
        if not line.strip():
            continue
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        
        line_lower = line.lower()
        should_highlight = any(q in line_lower for q in quotes_to_highlight if len(q) > 5)
        
        run = p.add_run(line)
        run.font.name = "Consolas"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(60, 60, 60)
        
        if should_highlight:
            run.font.highlight_color = WD_COLOR_INDEX.YELLOW

    doc.save(full_docx_path)
    print(f"\n[✓] Готово! Word-протокол успешно сохранен:\n    {full_docx_path}")
    return full_docx_path


# ==========================================
# ОСНОВНОЙ ВХОДНОЙ СЦЕНАРИЙ
# ==========================================
def main():
    print("=" * 60)
    print("   AI-АССИСТЕНТ РУКОВОДИТЕЛЯ: ГОЛОС -> ПРОТОКОЛ -> WORD")
    print("                 ООО «ФОТОПРИНТ» (Модуль AI)")
    print("=" * 60)

    print("\nВыберите способ ввода диалога:")
    print("  [1] Записать живой диалог с микрофона (вы и коллега)")
    print("  [2] Использовать готовый аудиофайл (meeting.wav / meeting.mp3)")
    print("  [3] Использовать контрольную текстовую стенограмму из ТЗ (без микрофона)")
    
    choice = input("\nВаш выбор [1, 2 или 3] (по умолчанию 1): ").strip() or "1"

    audio_file = "meeting.wav"
    transcript_text = ""

    if choice == "1":
        full_audio_path = record_audio(output_filename=audio_file)
        transcript_text = transcribe_audio(audio_path=full_audio_path)
    elif choice == "2":
        path_input = input(f"Введите путь к аудиофайлу (по умолчанию {audio_file}): ").strip() or audio_file
        if not os.path.isabs(path_input):
            path_input = os.path.join(BASE_DIR, path_input)
        if not os.path.exists(path_input):
            print(f"[!] Файл '{path_input}' не найден!")
            return
        transcript_text = transcribe_audio(audio_path=path_input)
    else:
        print("\n[*] Используем тестовую стенограмму планерки...")
        transcript_text = """[00:01] Директор: Коллеги, начинаем планерку по запуску фотокниг 20х20.
[00:12] Иванов (Нач. производства): Линию УФ-лакировки нужно перенастроить. Я лично закончу перенастройку до пятницы, 15 ноября.
[00:28] Директор: Отлично, фиксируем. Что со снабжением матовой бумагой?
[00:40] Петрова: Поставщик требует предоплату 50%, а у нас лимит 30%. Договор пока не подписан.
[00:55] Директор: Петрова, проведи повторные переговоры до четверга и согласуй лимит 30%.
[01:10] Иванов: При двукратном росте заказов возникнет дефицит людей в ночную смену на резке. Это серьезный риск срыва SLA.
[01:30] Директор: Вопрос ночной смены пока отложим, вернемся в понедельник после отчета маркетинга."""

    # Анализ через локальный Qwen 2.5
    analysis = analyze_with_llm(transcript_text)

    # Генерация Word-документа с желтой подсветкой
    docx_file = create_word_protocol(transcript_text, analysis)

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
