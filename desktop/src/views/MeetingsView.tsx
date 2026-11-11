import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_TRANSCRIPTS, MOCK_CALENDAR_SLOTS } from '../mock/mockData';
import { TaskItem, DecisionItem, RiskItem } from '../types';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
  Plus,
  Trash2,
  Check,
  CalendarPlus,
  ListTodo
} from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const { batchApproveTasks, logAudit, showToast } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'protocol' | 'prep' | 'calendar'>('protocol');

  // Protocol & Tasks State
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>(MOCK_TRANSCRIPTS[0].id);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasProcessed, setHasProcessed] = useState<boolean>(true); // Pre-processed by default for instant demo!
  const [customTranscriptText, setCustomTranscriptText] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  const currentTranscript = MOCK_TRANSCRIPTS.find((t) => t.id === selectedTranscriptId) || MOCK_TRANSCRIPTS[0];

  // Draft & Review Staged Tasks
  const [stagedTasks, setStagedTasks] = useState<Omit<TaskItem, 'id'>[]>(
    currentTranscript.stagedTasks.map((t) => ({
      title: t.title,
      assigneeName: t.assigneeName,
      deadline: t.deadline,
      sourceQuote: t.sourceQuote,
      timestamp: t.timestamp,
      status: 'pending_approval' as const,
    }))
  );

  const [decisions, setDecisions] = useState<DecisionItem[]>(currentTranscript.decisions);
  const [risks, setRisks] = useState<RiskItem[]>(currentTranscript.risks);
  const [summary, setSummary] = useState<string>(currentTranscript.summary);

  // Switch selected transcript
  const handleSelectTranscript = (id: string) => {
    setSelectedTranscriptId(id);
    setIsCustomMode(false);
    const found = MOCK_TRANSCRIPTS.find((t) => t.id === id) || MOCK_TRANSCRIPTS[0];
    setStagedTasks(
      found.stagedTasks.map((t) => ({
        title: t.title,
        assigneeName: t.assigneeName,
        deadline: t.deadline,
        sourceQuote: t.sourceQuote,
        timestamp: t.timestamp,
        status: 'pending_approval' as const,
      }))
    );
    setDecisions(found.decisions);
    setRisks(found.risks);
    setSummary(found.summary);
    setHasProcessed(true);
  };

  // Run AI processing simulation
  const handleProcessTranscript = () => {
    setIsProcessing(true);
    logAudit(
      'PROCESS_TRANSCRIPT',
      `Transcript: ${isCustomMode ? 'Пользовательский ввод' : currentTranscript.title}`,
      'SUCCESS',
      'Запущен локальный анализ расшифровки Qwen 2.5: извлечение решений, рисков и задач'
    );

    setTimeout(() => {
      setIsProcessing(false);
      setHasProcessed(true);
      showToast('Анализ завершен', 'AI успешно выделил решения и сформировал задачи на согласование', 'success');
    }, 800);
  };

  // Staged Tasks Actions
  const handleUpdateStagedTask = (index: number, field: string, value: string) => {
    setStagedTasks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteStagedTask = (index: number) => {
    setStagedTasks((prev) => prev.filter((_, i) => i !== index));
    showToast('Задача удалена из черновика', 'Задача исключена до внесения в реестр', 'info');
  };

  const handleAddStagedTask = () => {
    setStagedTasks((prev) => [
      ...prev,
      {
        title: 'Новое поручение по итогам встречи',
        assigneeName: 'требует уточнения',
        deadline: 'требует уточнения',
        sourceQuote: 'Добавлено вручную руководителем',
        timestamp: '00:00',
        status: 'pending_approval',
      },
    ]);
  };

  // Human-in-the-Loop Confirmation
  const handleApproveAll = () => {
    if (stagedTasks.length === 0) {
      showToast('Нет задач', 'Список задач пуст', 'warning');
      return;
    }
    batchApproveTasks(stagedTasks, currentTranscript.title);
    setStagedTasks([]);
  };

  const handleRejectAll = () => {
    logAudit(
      'REJECT_TASKS_DRAFT',
      `Transcript: ${currentTranscript.title}`,
      'REJECTED',
      'Руководитель отклонил предложенные AI задачи. Системы оставлены без изменений (AI-03)'
    );
    setStagedTasks([]);
    showToast('Черновик отклонен', 'Предложенные задачи удалены без изменения реестра', 'warning');
  };

  // Meeting Prep State
  const [prepTopic, setPrepTopic] = useState('Оптимизация выпуска фотокниг и устранение узких мест в цехе');
  const [prepGenerated, setPrepGenerated] = useState(false);

  // Calendar Booking State
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot-1');
  const [meetingCreated, setMeetingCreated] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Subtab Header */}
      <div className="h-12 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('protocol')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${
              activeSubTab === 'protocol'
                ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5 text-blue-400" />
            Протокол и задачи (Draft & Review)
          </button>

          <button
            onClick={() => setActiveSubTab('prep')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${
              activeSubTab === 'prep'
                ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Подготовка встречи (Повестка)
          </button>

          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${
              activeSubTab === 'calendar'
                ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
            Календарь и свободные слоты
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          AI: Qwen 2.5 Instruct · JSON Schema
        </div>
      </div>

      {/* Main SubTab Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* SUBTAB 1: PROTOCOL & DRAFT-REVIEW */}
        {activeSubTab === 'protocol' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column: Transcript Selector & Source Text (5 cols) */}
            <div className="col-span-5 space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Выбор контрольной расшифровки
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">3 записи в базе</span>
                </div>

                <div className="space-y-1.5">
                  {MOCK_TRANSCRIPTS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTranscript(t.id)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                        selectedTranscriptId === t.id && !isCustomMode
                          ? 'bg-blue-600/10 border-blue-500/40 text-blue-200'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold line-clamp-1">{t.title}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        <span>{t.date}</span>
                        <span>•</span>
                        <span className="text-slate-400">{t.type}</span>
                      </div>
                    </button>
                  ))}

                  <button
                    onClick={() => setIsCustomMode(true)}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition-all ${
                      isCustomMode
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-200'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    + Вставить свой текст / VTT файл
                  </button>
                </div>

                {/* Transcript Preview Area */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                    <span>Текст расшифровки с таймкодами:</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {isCustomMode ? 'Пользовательский' : `${currentTranscript.content.length} симв.`}
                    </span>
                  </div>

                  {isCustomMode ? (
                    <textarea
                      value={customTranscriptText}
                      onChange={(e) => setCustomTranscriptText(e.target.value)}
                      placeholder="Вставьте стенограмму встречи с таймкодами вида [01:23] Иванов: ..."
                      rows={10}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 resize-none"
                    />
                  ) : (
                    <div className="h-64 overflow-y-auto bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                      {currentTranscript.content}
                    </div>
                  )}

                  <button
                    onClick={handleProcessTranscript}
                    disabled={isProcessing}
                    className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isProcessing ? 'Локальная модель анализирует текст...' : 'Обработать расшифровку (AI)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: AI Extraction & Staged Review (7 cols) */}
            <div className="col-span-7 space-y-5">
              {hasProcessed ? (
                <>
                  {/* Summary Box */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      Исполнительное резюме (Executive Summary)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                      {summary}
                    </p>
                  </div>

                  {/* Decisions Grid (AI-04 requirement) */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Зафиксированные решения и вопросы (AI-04)
                      </div>
                      <span className="text-[10px] text-slate-400">Классификация модели</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {decisions.map((d) => {
                        let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        let label = 'РЕШЕНО';
                        if (d.category === 'proposed') {
                          badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                          label = 'ПРЕДЛОЖЕНО';
                        } else if (d.category === 'needs_clarification') {
                          badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                          label = 'ТРЕБУЕТ УТОЧНЕНИЯ';
                        }

                        return (
                          <div
                            key={d.id}
                            className="bg-slate-950/70 border border-slate-800/80 p-2.5 rounded-lg flex flex-col justify-between gap-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                {label}
                              </span>
                              {d.timestamp && (
                                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {d.timestamp}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-200 font-medium leading-snug">{d.text}</div>
                            {d.speaker && <div className="text-[10px] text-slate-400">Спикер: {d.speaker}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Risks Box */}
                  {risks.length > 0 && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Выявленные риски встречи
                      </div>
                      <div className="space-y-1.5">
                        {risks.map((r) => (
                          <div
                            key={r.id}
                            className="bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg text-xs text-slate-300 flex items-start gap-2"
                          >
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 mt-0.5">
                              {r.impact} RISK
                            </span>
                            <div>
                              <div className="font-medium text-slate-200">{r.riskDescription}</div>
                              {r.suggestedMitigation && (
                                <div className="text-[11px] text-rose-300/80 mt-0.5">
                                  Рекомендация: {r.suggestedMitigation}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DRAFT & REVIEW: STAGED TASKS (Crucial Hackathon Requirement AI-03 / Section 7.5) */}
                  <div className="bg-slate-900/80 border-2 border-blue-500/40 rounded-xl p-4 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="text-xs font-bold text-blue-300 flex items-center gap-2">
                          <Check className="w-4 h-4 text-blue-400" />
                          Согласование поручений (Draft & Review · AI-03)
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Поручения не попадают в реестр до вашего утверждения. Вы можете исправить любые поля.
                        </div>
                      </div>

                      <button
                        onClick={handleAddStagedTask}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-300 hover:text-white bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-md transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Добавить задачу
                      </button>
                    </div>

                    {/* Staged Tasks List */}
                    {stagedTasks.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Все задачи согласованы и записаны в реестр или черновик был отклонен.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stagedTasks.map((task, idx) => {
                          const isUnassigned = task.assigneeName.includes('требует уточнения');
                          const isNoDeadline = task.deadline.includes('требует уточнения');

                          return (
                            <div
                              key={idx}
                              className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={task.title}
                                    onChange={(e) => handleUpdateStagedTask(idx, 'title', e.target.value)}
                                    className="w-full bg-transparent font-semibold text-xs text-slate-100 border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none pb-0.5"
                                  />
                                </div>
                                <button
                                  onClick={() => handleDeleteStagedTask(idx)}
                                  className="text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Удалить из списка"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                  <label className="text-[10px] text-slate-400 block mb-0.5">Ответственный:</label>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={task.assigneeName}
                                      onChange={(e) => handleUpdateStagedTask(idx, 'assigneeName', e.target.value)}
                                      className={`w-full bg-slate-900 px-2 py-1 rounded text-xs text-slate-200 border focus:outline-none ${
                                        isUnassigned
                                          ? 'border-amber-500/50 text-amber-300'
                                          : 'border-slate-700 focus:border-blue-500'
                                      }`}
                                    />
                                    {isUnassigned && (
                                      <span title="Не найдено в расшифровке (AI-05)">
                                        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 block mb-0.5">Срок исполнения:</label>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={task.deadline}
                                      onChange={(e) => handleUpdateStagedTask(idx, 'deadline', e.target.value)}
                                      className={`w-full bg-slate-900 px-2 py-1 rounded text-xs text-slate-200 border focus:outline-none ${
                                        isNoDeadline
                                          ? 'border-amber-500/50 text-amber-300'
                                          : 'border-slate-700 focus:border-blue-500'
                                      }`}
                                    />
                                    {isNoDeadline && (
                                      <span title="Срок не был озвучен (AI-05)">
                                        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Citation Excerpt */}
                              {task.sourceQuote && (
                                <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80 italic flex items-center justify-between">
                                  <span>Основание: «{task.sourceQuote}»</span>
                                  {task.timestamp && (
                                    <span className="font-mono text-slate-400 not-italic shrink-0 ml-2">
                                      [{task.timestamp}]
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Confirmation Bottom Bar */}
                        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                          <button
                            onClick={handleRejectAll}
                            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Отклонить черновик
                          </button>

                          <button
                            onClick={handleApproveAll}
                            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 shadow-md transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Подтвердить и зафиксировать в реестре ({stagedTasks.length})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center p-12 text-slate-400 text-xs text-center border border-dashed border-slate-800 rounded-xl">
                  Выберите расшифровку и нажмите «Обработать расшифровку (AI)»
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 2: MEETING PREPARATION (Scenario 1) */}
        {activeSubTab === 'prep' && (
          <div className="max-w-3xl mx-auto bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Сценарий 1: Интеллектуальная подготовка к встрече
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Ассистент анализирует тему, проверяет открытые задачи по участникам и формирует повестку с открытыми вопросами.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Тема совещания:</label>
                <input
                  type="text"
                  value={prepTopic}
                  onChange={(e) => setPrepTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Обязательные участники:</label>
                  <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg space-y-1.5 text-xs text-slate-300">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-900" />
                      Смирнов А.В. (Генеральный директор)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-900" />
                      Иванов И.С. (Начальник производства)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-900" />
                      Ковалева Е.Д. (Клиентский сервис)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Привязка регламентов (RBAC):</label>
                  <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg space-y-1.5 text-xs text-slate-300">
                    <div className="text-[11px] text-blue-400 font-medium">✓ Техкарта цифровой печати HP Indigo</div>
                    <div className="text-[11px] text-blue-400 font-medium">✓ Классификатор производственного брака</div>
                    <div className="text-[11px] text-slate-400">Доступ разрешен для текущей роли</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setPrepGenerated(true);
                  logAudit('GENERATE_AGENDA', `Topic: ${prepTopic}`, 'SUCCESS', 'Сформирован проект повестки и 3 открытых вопроса');
                  showToast('Повестка готова', 'Проект повестки и открытые вопросы сформированы', 'success');
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Сформировать проект повестки и открытые вопросы
              </button>

              {prepGenerated && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4 animate-in fade-in">
                  <div>
                    <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      Предлагаемая повестка встречи (Рекомендуемое время: 45 мин):
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed">
                      <li>Анализ инцидента сбоя линии УФ-лакировки и статистика списания (10 мин)</li>
                      <li>
                        Статус исполнения поручения: «Заказ запасного комплекта датчиков у Полиграф-Сервис» (Иванов, 10 мин)
                      </li>
                      <li>Меры клиентской компенсации и доставка задержанных заказов PicPac (Ковалева, 15 мин)</li>
                      <li>Утверждение графика превентивного ТО плоттеров цеха (10 мин)</li>
                    </ol>
                  </div>

                  <div className="pt-3 border-t border-slate-800">
                    <div className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Открытые вопросы из предыдущих протоколов, требующие решения:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                      <li>Не согласована точная дата калибровки плоттера Zund сервисной службой.</li>
                      <li>Ожидается подтверждение ставки субаренды дополнительного упаковочного склада на декабрь.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 3: CALENDAR & FREE SLOTS (Scenario 2) */}
        {activeSubTab === 'calendar' && (
          <div className="max-w-3xl mx-auto bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-emerald-400" />
                Сценарий 2: Поиск слота и создание встречи (Human-in-the-Loop AI-03)
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Система предлагает пересечения свободных слотов в мок-календаре участников. Событие создается только после
                ручного подтверждения.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Свободные окна в календаре ключевых участников:</label>
                <div className="grid grid-cols-2 gap-3">
                  {MOCK_CALENDAR_SLOTS.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      disabled={!slot.isAvailable}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        selectedSlotId === slot.id
                          ? 'bg-emerald-600/10 border-emerald-500/40 text-emerald-200'
                          : slot.isAvailable
                          ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          : 'bg-slate-950/30 border-slate-900 text-slate-400 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{slot.date}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${slot.isAvailable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'}`}>
                          {slot.isAvailable ? `${slot.startTime} – ${slot.endTime}` : 'Занято'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Свободны: {slot.participantsFree.join(', ')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Draft Meeting Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Предпросмотр карточки события:</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Статус: Ожидает подтверждения
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <div><strong>Тема:</strong> {prepTopic}</div>
                  <div><strong>Время:</strong> 12 ноября 2026, 10:00 – 11:00 (МСК)</div>
                  <div><strong>Место:</strong> Переговорная цеха №1 / Локальный телемост</div>
                  <div><strong>Участники:</strong> Смирнов А.В., Иванов И.С., Ковалева Е.Д.</div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setMeetingCreated(true);
                      logAudit('SCHEDULE_MEETING', 'Meeting: ' + prepTopic, 'SUCCESS', 'Встреча создана в локальном календаре после акцепта пользователя');
                      showToast('Встреча создана', 'Событие внесено в календарь, приглашения отправлены участникам', 'success');
                    }}
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Подтвердить создание встречи
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
