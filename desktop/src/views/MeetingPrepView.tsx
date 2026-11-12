import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiClient } from '../api/apiClient';
import {
  Sparkles,
  FileSpreadsheet,
  Users,
  FileText,
  Clock,
  ArrowRight,
  HelpCircle,
  CheckSquare,
  Plus,
  Trash2,
  RefreshCw,
  ShieldAlert,
  Sliders
} from 'lucide-react';

export const MeetingPrepView: React.FC = () => {
  const {
    meetingDraft,
    setMeetingDraft,
    setActiveTab,
    users,
    documents,
    canAccessDocument,
    backendOnline,
    logAudit,
    showToast
  } = useApp();

  const [topic, setTopic] = useState<string>(meetingDraft.topic);
  const [participants, setParticipants] = useState<string[]>(meetingDraft.participants);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(meetingDraft.documents);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [newAgendaItem, setNewAgendaItem] = useState<string>('');

  const PRESET_TOPICS = [
    {
      title: 'Ввод в эксплуатацию ЦПМ Canon imagePRESS V1000',
      participants: ['Смирнов А.В. (Ген. директор)', 'Иванов И.С. (Нач. производства)'],
      docs: ['Техкарта оборудования и требования к электропитанию', 'План производства и загрузка цеха на Q4']
    },
    {
      title: 'Разбор аварии датчика оптической вязкости УФ-лака и брака 3.2%',
      participants: ['Смирнов А.В. (Ген. директор)', 'Иванов И.С. (Нач. производства)', 'Ковалева Е.Д. (Рук. сервиса)'],
      docs: ['Техкарта оборудования и требования к электропитанию', 'Регламент контроля брака и технологических допусков']
    },
    {
      title: 'Субаренда упаковочного склада и график отгрузок в новогодний пик',
      participants: ['Смирнов А.В. (Ген. директор)', 'Ковалева Е.Д. (Рук. сервиса)'],
      docs: ['План производства и загрузка цеха на Q4', 'Регламент клиентского сервиса picPac.by']
    }
  ];

  const handleApplyPreset = (preset: typeof PRESET_TOPICS[0]) => {
    setTopic(preset.title);
    setParticipants(preset.participants);
    setSelectedDocs(preset.docs);
    showToast('Шаблон применен', preset.title, 'info');
  };

  const handleToggleParticipant = (userName: string) => {
    setParticipants((prev) =>
      prev.includes(userName) ? prev.filter((p) => p !== userName) : [...prev, userName]
    );
  };

  const handleToggleDoc = (docTitle: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docTitle) ? prev.filter((d) => d !== docTitle) : [...prev, docTitle]
    );
  };

  const handleGenerateAgenda = async () => {
    if (!topic.trim()) {
      showToast('Укажите тему', 'Тема совещания обязательна для подготовки', 'warning');
      return;
    }
    if (participants.length === 0) {
      showToast('Выберите участников', 'Должен быть выбран хотя бы один участник', 'warning');
      return;
    }

    setIsGenerating(true);
    showToast('Генерация повестки', 'AI анализирует тему и разрешенные регламенты...', 'info');

    try {
      if (backendOnline) {
        const res = await apiClient.generateAgenda({
          topic,
          participants,
          documents: selectedDocs
        });

        if (res && res.agenda && res.agenda.length > 0) {
          const generatedTasks = [
            `Подготовить выгрузку телеметрии и актов по участку: «${topic}»`,
            `Согласовать смету расходов до даты совещания`
          ];

          setMeetingDraft({
            topic,
            participants,
            documents: selectedDocs,
            agenda: res.agenda,
            openQuestions: res.openQuestions || [],
            openTasks: generatedTasks
          });

          logAudit(
            'GENERATE_AGENDA',
            `Повестка: ${topic}`,
            'SUCCESS',
            `Сформирован проект повестки (${res.agenda.length} пунктов) и открытых вопросов по документам`
          );

          showToast('Повестка готова', 'AI успешно сформировал проект повестки, задачи и вопросы', 'success');
          return;
        }
      }
    } catch {
      // fallback to offline logic
    } finally {
      setIsGenerating(false);
    }

    // Local deterministic synthesis based on topic and documents
    const defaultAgenda = [
      `1. Оценка текущей ситуации и ключевых рисков по теме: «${topic}» (15 мин)`,
      `2. Анализ технологических требований регламентов: ${selectedDocs.length > 0 ? selectedDocs.join(', ') : 'Общие стандарты'} (20 мин)`,
      `3. Утверждение графика работ и распределение персональной ответственности (15 мин)`
    ];

    const defaultQuestions = [
      `• Какие критические блокеры зафиксированы по направлению «${topic}»?`,
      `• Требуется ли выделение дополнительного бюджета или согласование с дирекцией?`,
      `• Обеспечен ли доступ специалистов на производственный участок?`
    ];

    const defaultTasks = [
      `Предоставить предварительный срез выработки и отчет по браку`,
      `Подготовить проект соглашения с контрагентами к началу совещания`
    ];

    setMeetingDraft({
      topic,
      participants,
      documents: selectedDocs,
      agenda: defaultAgenda,
      openQuestions: defaultQuestions,
      openTasks: defaultTasks
    });

    logAudit(
      'GENERATE_AGENDA',
      `Повестка: ${topic}`,
      'SUCCESS',
      `Сформирован проект повестки (${defaultAgenda.length} пунктов) и открытых вопросов`
    );

    showToast('Повестка сформирована', 'Проект повестки, задачи и открытые вопросы подготовлены', 'success');
  };

  const handleAddAgendaItem = () => {
    if (!newAgendaItem.trim()) return;
    setMeetingDraft((prev) => ({
      ...prev,
      agenda: [...prev.agenda, `${prev.agenda.length + 1}. ${newAgendaItem.trim()}`]
    }));
    setNewAgendaItem('');
  };

  const handleDeleteAgendaItem = (index: number) => {
    setMeetingDraft((prev) => ({
      ...prev,
      agenda: prev.agenda.filter((_, i) => i !== index)
    }));
  };

  const handleProceedToScheduling = () => {
    if (!topic.trim()) {
      showToast('Укажите тему', 'Тема совещания обязательна для подготовки встречи', 'warning');
      return;
    }
    setMeetingDraft((prev) => ({
      ...prev,
      topic,
      participants,
      documents: selectedDocs
    }));
    setActiveTab('meeting_schedule');
    showToast(
      'Повестка подготовлена',
      'Проект повестки передан в модуль согласования слота календаря',
      'info'
    );
  };

  // Accessible documents filtered by RBAC
  const accessibleDocs = documents.filter((doc) => canAccessDocument(doc.minClearance));

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
                Подготовка встречи
              </h1>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Формирование проекта повестки, открытых задач и вопросов по теме, участникам и разрешённым документам
            </p>
          </div>

          <button
            onClick={handleProceedToScheduling}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm"
          >
            <span>Перейти к созданию встречи</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PRESET SHORTCUTS                                                          */}
        {/* ========================================================================= */}
        <div className="p-3.5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            <Sliders className="w-3.5 h-3.5 text-sky-500" />
            <span>Типовые темы совещаний дирекции:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_TOPICS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(preset)}
                className="text-xs px-2.5 py-1.5 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d26] dark:hover:bg-[#252a38] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#282d3b] transition-colors text-left"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN WORKSPACE GRID: INPUT FORM (LEFT) vs AI GENERATION (RIGHT)           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: PARAMETERS (5 COLS) */}
          <div className="lg:col-span-5 space-y-5 bg-white dark:bg-[#13151b] p-5 rounded-lg border border-neutral-200 dark:border-[#212530]">
            {/* Topic Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-500" />
                <span>Тема совещания</span>
              </label>
              <textarea
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Например: Ввод в эксплуатацию ЦПМ Canon imagePRESS V1000..."
                className="w-full text-xs bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262b3a] rounded p-2.5 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Participants Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-500" />
                  <span>Участники ({participants.length})</span>
                </label>
                <span className="text-[11px] text-neutral-400 font-mono">Из штатного расписания</span>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(users.length > 0 ? users : [
                  { id: 'u-1', name: 'Смирнов Алексей Викторович', roleTitle: 'Генеральный директор', department: 'Дирекция' },
                  { id: 'u-2', name: 'Иванов Игорь Сергеевич', roleTitle: 'Начальник производства', department: 'Цех' },
                  { id: 'u-3', name: 'Ковалева Елена Дмитриевна', roleTitle: 'Руководитель сервиса', department: 'picPac.by' },
                  { id: 'u-4', name: 'Петров Дмитрий Сергеевич', roleTitle: 'Главный технолог', department: 'ОТК' }
                ]).map((u) => {
                  const label = `${u.name.split(' ')[0]} ${u.name.split(' ')[1]?.[0] || ''}.${u.name.split(' ')[2]?.[0] || ''}. (${u.roleTitle})`;
                  const isChecked = participants.includes(label) || participants.some(p => p.includes(u.name.split(' ')[0]));

                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer border transition-colors ${
                        isChecked
                          ? 'bg-sky-50/70 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-200 font-medium'
                          : 'bg-neutral-50 dark:bg-[#171922] border-neutral-200 dark:border-[#262a36] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#1e222e]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleParticipant(label)}
                        className="rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                      />
                      <div className="min-w-0 flex-1 truncate">
                        <div className="truncate font-semibold">{u.name}</div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{u.roleTitle} · {u.department}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Allowed Documents Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-500" />
                  <span>Разрешённые документы ({selectedDocs.length})</span>
                </label>
                <span className="text-[11px] text-neutral-400 font-mono">RBAC-фильтрация</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(accessibleDocs.length > 0 ? accessibleDocs : documents).map((doc) => {
                  const isChecked = selectedDocs.includes(doc.title);

                  return (
                    <label
                      key={doc.id}
                      className={`flex items-start gap-2 p-2 rounded text-xs cursor-pointer border transition-colors ${
                        isChecked
                          ? 'bg-sky-50/70 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-200 font-medium'
                          : 'bg-neutral-50 dark:bg-[#171922] border-neutral-200 dark:border-[#262a36] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#1e222e]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDoc(doc.title)}
                        className="mt-0.5 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{doc.title}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                          <span>{doc.category}</span>
                          <span>·</span>
                          <span className="font-mono">Допуск {doc.minClearance}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              onClick={handleGenerateAgenda}
              disabled={isGenerating}
              className="w-full py-2.5 px-4 rounded-md text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>AI-генерация по регламентам...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Сформировать проект повестки, задач и вопросов</span>
                </>
              )}
            </button>
          </div>

          {/* RIGHT COLUMN: AI-GENERATED OUTPUT (7 COLS) */}
          <div className="lg:col-span-7 space-y-5">
            {/* AGENDA BLOCK */}
            <div className="p-5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-500" />
                  <h3 className="text-xs font-bold text-neutral-950 dark:text-white uppercase tracking-wider font-mono">
                    Проект повестки совещания
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  {meetingDraft.agenda.length} пунктов регламента
                </span>
              </div>

              {meetingDraft.agenda.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-400">
                  Повестка пока не сформирована. Нажмите кнопку генерации слева.
                </div>
              ) : (
                <div className="space-y-2">
                  {meetingDraft.agenda.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-md bg-neutral-50 dark:bg-[#171922] border border-neutral-200/80 dark:border-[#262b3a] flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-neutral-850 dark:text-neutral-200 leading-relaxed font-medium">
                        {item}
                      </span>
                      <button
                        onClick={() => handleDeleteAgendaItem(idx)}
                        className="text-neutral-400 hover:text-rose-500 p-1 rounded transition-colors shrink-0"
                        title="Удалить пункт"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add item input */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newAgendaItem}
                  onChange={(e) => setNewAgendaItem(e.target.value)}
                  placeholder="Добавить свой пункт в повестку..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAgendaItem()}
                  className="flex-1 text-xs bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262b3a] rounded px-3 py-1.5 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleAddAgendaItem}
                  className="px-3 py-1.5 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d25] dark:hover:bg-[#252a36] text-neutral-700 dark:text-neutral-200 rounded border border-neutral-200 dark:border-[#282d3b] flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>

            {/* OPEN QUESTIONS BLOCK */}
            <div className="p-5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-neutral-950 dark:text-white uppercase tracking-wider font-mono">
                    Список открытых вопросов к обсуждению
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  {meetingDraft.openQuestions.length} вопросов
                </span>
              </div>

              {meetingDraft.openQuestions.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-400">
                  Список открытых вопросов будет автоматически сформирован нейросетью.
                </div>
              ) : (
                <div className="space-y-2">
                  {meetingDraft.openQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-md bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5"
                    >
                      <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0">?</span>
                      <span className="leading-relaxed">{q.replace(/^[•\s]+/, '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OPEN TASKS BLOCK */}
            <div className="p-5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold text-neutral-950 dark:text-white uppercase tracking-wider font-mono">
                    Список открытых задач по документам
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  {meetingDraft.openTasks.length} задач
                </span>
              </div>

              {meetingDraft.openTasks.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-400">
                  Список задач будет извлечен из нормативных регламентов после генерации.
                </div>
              ) : (
                <div className="space-y-2">
                  {meetingDraft.openTasks.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-md bg-neutral-50 dark:bg-[#171922] border border-neutral-200/80 dark:border-[#262b3a] text-xs text-neutral-800 dark:text-neutral-200 flex items-center gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="leading-relaxed font-medium">{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACTION BANNER */}
            {meetingDraft.agenda.length > 0 && (
              <div className="p-4 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-sky-950 dark:text-sky-200">
                    Повестка, вопросы и задачи готовы к согласованию
                  </div>
                  <div className="text-[11px] text-sky-700 dark:text-sky-400 mt-0.5">
                    Подберите свободное время в календаре и подтвердите создание встречи.
                  </div>
                </div>

                <button
                  onClick={handleProceedToScheduling}
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <span>Перейти к созданию встречи</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
