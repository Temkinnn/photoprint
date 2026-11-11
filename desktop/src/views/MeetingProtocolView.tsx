import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { TaskItem } from '../types';
import {
  FileText,
  Sparkles,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  CheckCheck,
  Clock,
  User,
  Quote,
  Eye,
  EyeOff,
  Mic,
  Loader2
} from 'lucide-react';

export const MeetingProtocolView: React.FC = () => {
  const {
    transcripts,
    analyzeMeetingTranscript,
    processAudioMeeting,
    batchApproveTasks,
    setActiveTab,
    logAudit,
    showToast
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>(transcripts[0]?.id || 'tr-01');
  const [showFullTranscript, setShowFullTranscript] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);

  const currentTranscript = transcripts.find((t) => t.id === selectedTranscriptId) || transcripts[0] || {
    id: 'tr-01',
    title: 'Внеплановое совещание по всплеску брака в цехе',
    date: '2026-11-10',
    duration: '42 мин',
    content: 'Иванов И.С.: Зафиксирован сбой оптического датчика УФ-лака...',
    decisions: [
      { id: 'd-1', category: 'resolved', text: 'Заменить оптический датчик вязкости УФ-лакировки до конца недели.' },
      { id: 'd-2', category: 'resolved', text: 'Ввести двойной выборочный контроль первых 50 листов тиража.' }
    ],
    risks: [
      { id: 'r-1', riskDescription: 'Превышение лимита брака до 3.5% в ночную смену', impact: 'High', suggestedMitigation: 'Остановка секции лака при вязкости выше 45с' },
      { id: 'r-2', riskDescription: 'Срыв сроков печати фотокниг премиум-линейки', impact: 'Medium', suggestedMitigation: 'Резервирование мощностей машины Canon V1000' }
    ],
    questions: [
      'Согласован ли аварийный бюджет 65 000 руб. на закупку запасных датчиков?',
      'Требуется ли вызов инженера сервисной службы поставщика лака?'
    ],
    stagedTasks: [
      {
        title: 'Закупка запасного оптического датчика УФ-линии',
        assigneeName: 'Иванов И.С.',
        deadline: '2026-11-14',
        sourceQuote: 'Иванов: я запрошу счет у поставщика до четверга',
        timestamp: '00:14:20',
        status: 'pending_approval'
      },
      {
        title: 'Уведомить клиентов о смещении отгрузки тиража на 4 часа',
        assigneeName: 'Ковалева Е.Д.',
        deadline: '2026-11-11',
        sourceQuote: 'Ковалева: мы подготовим рассылку и персональные звонки',
        timestamp: '00:28:10',
        status: 'pending_approval'
      }
    ]
  };

  const [tasksToReview, setTasksToReview] = useState<Omit<TaskItem, 'id'>[]>(
    (currentTranscript.stagedTasks || []).map((t) => ({
      title: t.title,
      assigneeName: t.assigneeName,
      deadline: t.deadline,
      sourceQuote: t.sourceQuote,
      timestamp: t.timestamp || '00:00',
      status: 'pending_approval' as const
    }))
  );

  const handleSelectTranscript = (id: string) => {
    setSelectedTranscriptId(id);
    const found = transcripts.find((t) => t.id === id);
    if (found && found.stagedTasks) {
      setTasksToReview(
        found.stagedTasks.map((t) => ({
          title: t.title,
          assigneeName: t.assigneeName,
          deadline: t.deadline,
          sourceQuote: t.sourceQuote,
          timestamp: t.timestamp || '00:00',
          status: 'pending_approval' as const
        }))
      );
    }
  };

  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    showToast('AI-Анализ встречи', 'Обработка расшифровки нейросетевым модулем...', 'info');

    try {
      const res = await analyzeMeetingTranscript(currentTranscript.content, currentTranscript.title);
      if (res && res.tasks.length > 0) {
        setTasksToReview(
          res.tasks.map((t) => ({
            title: t.title,
            assigneeName: t.assigneeName,
            deadline: t.deadline,
            sourceQuote: t.sourceQuote,
            timestamp: t.timestamp || '00:00',
            status: 'pending_approval' as const
          }))
        );
        showToast('Анализ завершен', `Извлечено решений: ${res.decisions.length}, задач: ${res.tasks.length}`, 'success');
      } else {
        showToast('Анализ завершен', 'Стенограмма успешно проанализирована', 'info');
      }
    } catch {
      showToast('Ошибка анализа', 'Не удалось связаться с модулем анализа', 'warning');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAudio(true);
    showToast(
      'Обработка аудиозаписи',
      `Файл «${file.name}» передан на Whisper STT и Qwen 2.5...`,
      'info'
    );

    try {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const res = await processAudioMeeting(file, cleanTitle);
      if (res) {
        if (res.transcriptId) {
          setSelectedTranscriptId(res.transcriptId);
        }
        if (res.tasks && res.tasks.length > 0) {
          setTasksToReview(
            res.tasks.map((t) => ({
              title: t.title,
              assigneeName: t.assigneeName,
              deadline: t.deadline,
              sourceQuote: t.sourceQuote,
              timestamp: t.timestamp || '00:00',
              status: 'pending_approval' as const,
            }))
          );
        }
        showToast(
          'Аудио расшифровано',
          `Выделено решений: ${res.decisions.length}, задач: ${res.tasks.length}`,
          'success'
        );
      } else {
        showToast('Внимание', 'Не удалось обработать аудио через удаленный сервер', 'warning');
      }
    } catch {
      showToast('Ошибка аудио', 'Произошла ошибка при отправке аудио на AI-сервер', 'warning');
    } finally {
      setIsUploadingAudio(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProtocol = () => {
    const protocolRef = `#transcript-${currentTranscript.id}`;
    logAudit(
      'SAVE_PROTOCOL',
      `Протокол: ${currentTranscript.title}`,
      'SUCCESS',
      `Протокол совещания успешно сохранен со ссылкой на исходную расшифровку (${protocolRef})`
    );
    showToast(
      'Протокол зафиксирован',
      `Протокол сохранен со ссылкой на исходную расшифровку (${protocolRef})`,
      'success'
    );
  };

  const handleApproveAllTasks = async () => {
    if (tasksToReview.length === 0) {
      showToast('Нет задач', 'Все задачи уже подтверждены', 'info');
      return;
    }
    await batchApproveTasks(tasksToReview, currentTranscript.title);
    setTasksToReview([]);
    showToast('Задачи внесены в реестр', 'Поручения записаны в базу данных', 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-y-auto p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* ========================================================================= */}
        {/* HEADER                                                                    */}
        {/* ========================================================================= */}
        <div className="pb-4 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
              <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight">
                Протокол и summary встречи
              </h1>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Из тестовой расшифровки выделить решения, вопросы, риски и задачи; сохранить протокол со ссылкой на расшифровку
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('meeting_schedule')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-[#161820] hover:bg-neutral-100 dark:hover:bg-[#1f232e] border border-neutral-200 dark:border-[#262a36] rounded transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Назад к календарю</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm"
            >
              <span>Перейти к реестру задач</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CONTROL TOOLBAR: SELECT TRANSCRIPT & ACTIONS                              */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-500" />
              <span>Тестовая расшифровка:</span>
            </div>

            <div className="relative">
              <select
                value={selectedTranscriptId}
                onChange={(e) => handleSelectTranscript(e.target.value)}
                className="bg-neutral-50 dark:bg-[#1a1d25] border border-neutral-200 dark:border-[#282d3b] text-neutral-900 dark:text-neutral-200 text-xs rounded-md px-3 py-1.5 pr-8 focus:outline-none focus:border-sky-500 font-medium appearance-none cursor-pointer"
              >
                {transcripts.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.date})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <span className="text-[11px] font-mono text-neutral-400">
              Длительность: {currentTranscript.duration || '40 мин'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAudioFileChange}
              accept="audio/*,.wav,.ogg,.mp3,.m4a"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAudio}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-300 dark:border-sky-800 rounded transition-colors shadow-sm disabled:opacity-50"
              title="Загрузить аудиозапись (.wav, .ogg, .mp3) для распознавания Whisper и извлечения задач Qwen 2.5"
            >
              {isUploadingAudio ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-sky-500" />
              )}
              <span>{isUploadingAudio ? 'Whisper STT...' : 'Загрузить аудио (.wav, .ogg)'}</span>
            </button>

            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d25] dark:hover:bg-[#252936] rounded border border-neutral-200 dark:border-[#272b39] transition-colors"
            >
              {showFullTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showFullTranscript ? 'Скрыть текст расшифровки' : 'Показать текст расшифровки'}</span>
            </button>

            <button
              onClick={handleRunAiAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 rounded transition-colors shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isAnalyzing ? 'Анализ...' : 'AI-Анализ встречи'}</span>
            </button>

            <button
              onClick={handleSaveProtocol}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-sm"
              title="Сохранить протокол со ссылкой на исходную расшифровку"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Сохранить протокол</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLLAPSIBLE TRANSCRIPT VIEWER WITH TIMECODES                              */}
        {/* ========================================================================= */}
        {showFullTranscript && (
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-[#111319] border border-neutral-200 dark:border-[#212530] space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs pb-1.5 border-b border-neutral-200 dark:border-[#1d2028]">
              <span className="font-mono text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1.5">
                <Quote className="w-3 h-3 text-sky-500" />
                Исходная стенограмма встречи (ID: {currentTranscript.id})
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                Ссылка протокола: #transcript-{currentTranscript.id}
              </span>
            </div>

            <div className="text-xs text-neutral-700 dark:text-neutral-300 font-mono leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line p-2 bg-white dark:bg-[#0c0d12] rounded border border-neutral-200 dark:border-[#1d2028]">
              {currentTranscript.content}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUMMARY SECTIONS: DECISIONS, QUESTIONS, RISKS, TASKS                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KEY DECISIONS */}
          <div className="p-4 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] border-t-2 border-t-emerald-500 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Ключевые решения</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {(currentTranscript.decisions || []).length} принято
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {(currentTranscript.decisions || []).map((d) => (
                <div key={d.id} className="p-2.5 rounded bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-950 dark:text-emerald-200 leading-snug">
                  <div className="font-medium">{d.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* OPEN QUESTIONS */}
          <div className="p-4 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] border-t-2 border-t-sky-500 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-sky-500" />
                <span>Открытые вопросы</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400">
                {(currentTranscript.questions || []).length} открыто
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {(currentTranscript.questions || []).map((q: string, idx: number) => (
                <div key={idx} className="p-2.5 rounded bg-sky-50/50 dark:bg-sky-950/15 border border-sky-200/50 dark:border-sky-900/30 text-sky-950 dark:text-sky-200 leading-snug">
                  <div className="font-medium">{q}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RISKS & MITIGATIONS */}
          <div className="p-4 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] border-t-2 border-t-amber-500 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Производственные риски</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                {(currentTranscript.risks || []).length} риска
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {(currentTranscript.risks || []).map((r) => (
                <div key={r.id} className="p-2.5 rounded bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/50 dark:border-amber-900/30 text-amber-950 dark:text-amber-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.riskDescription}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      {r.impact}
                    </span>
                  </div>
                  {r.suggestedMitigation && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 pt-1 border-t border-amber-200/40 dark:border-amber-900/30">
                      Меры: {r.suggestedMitigation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* EXTRACTED ACTION ITEMS / TASKS TABLE                                      */}
        {/* ========================================================================= */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
            <div>
              <h3 className="text-xs font-bold text-neutral-950 dark:text-white uppercase tracking-wider font-mono">
                Выявленные поручения по итогам встречи
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Поручения, извлеченные AI из реплик спикеров с привязкой к таймкодам
              </p>
            </div>

            {tasksToReview.length > 0 && (
              <button
                onClick={handleApproveAllTasks}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-sm"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Утвердить все и внести в реестр ({tasksToReview.length})</span>
              </button>
            )}
          </div>

          {tasksToReview.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-400">
              Все поручения утверждены и внесены в реестр задач.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-[#212530]">
              {tasksToReview.map((task, idx) => (
                <div key={idx} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{task.title}</span>
                      <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.2 rounded">
                        {task.timestamp}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-500 italic">
                      «{task.sourceQuote}»
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-neutral-400" />
                        {task.assigneeName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        Срок: {task.deadline}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    Ожидает утверждения
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
