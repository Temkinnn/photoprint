import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TaskItem } from '../types';
import {
  CheckSquare,
  Search,
  Plus,
  CheckCircle2,
  Calendar,
  Trash2,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  User,
  Clock,
  CheckCheck,
  Copy
} from 'lucide-react';

export const TasksView: React.FC = () => {
  const { tasks, toggleTaskStatus, addTask, updateTask, deleteTask, setActiveTab, logAudit, showToast } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [newTitle, setNewTitle] = useState<string>('');
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [newDeadline, setNewDeadline] = useState<string>('');

  // Scenario 4: Tasks without owner or without deadline
  const isUnassignedOrUndated = (t: TaskItem) =>
    !t.assigneeName ||
    t.assigneeName === 'Не назначен' ||
    t.assigneeName === 'Назначить ответственного' ||
    t.assigneeName.includes('Требует') ||
    !t.deadline ||
    t.deadline === 'Бессрочно' ||
    t.deadline === 'Указать срок';

  const unassignedTasks = tasks.filter(isUnassignedOrUndated);

  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { assignee: string; deadline: string; reason: string }>>({});

  const handleGenerateSuggestions = () => {
    const suggestions: Record<string, { assignee: string; deadline: string; reason: string }> = {};

    unassignedTasks.forEach((task) => {
      const lower = task.title.toLowerCase();
      if (lower.includes('брак') || lower.includes('датчик') || lower.includes('лак') || lower.includes('оборудован') || lower.includes('цпм')) {
        suggestions[task.id] = {
          assignee: 'Иванов И.С. (Нач. производства)',
          deadline: '2026-11-16',
          reason: 'Компетенция начальника производства по цеху и техобслуживанию'
        };
      } else if (lower.includes('клиент') || lower.includes('рекламац') || lower.includes('заказ') || lower.includes('упаковк') || lower.includes('сервис')) {
        suggestions[task.id] = {
          assignee: 'Ковалева Е.Д. (Рук. сервиса)',
          deadline: '2026-11-15',
          reason: 'Компетенция руководителя службы заботы picPac.by'
        };
      } else {
        suggestions[task.id] = {
          assignee: 'Смирнов А.В. (Директор)',
          deadline: '2026-11-18',
          reason: 'Управленческое решение генерального директора'
        };
      }
    });

    setAiSuggestions(suggestions);
    showToast(
      'Предложения сформированы',
      `AI подобрал ответственных и сроки для ${Object.keys(suggestions).length} задач`,
      'info'
    );
  };

  const handleConfirmSuggestion = async (taskId: string) => {
    const sug = aiSuggestions[taskId];
    if (!sug) return;

    await updateTask(taskId, {
      assigneeName: sug.assignee,
      deadline: sug.deadline,
      status: 'active'
    });

    logAudit(
      'ASSIGN_TASK_CONFIRMED',
      `Задача ID: ${taskId}`,
      'SUCCESS',
      `Пользователь подтвердил назначение: ${sug.assignee}, срок: ${sug.deadline}`
    );

    setAiSuggestions((prev) => {
      const copy = { ...prev };
      delete copy[taskId];
      return copy;
    });

    showToast('Поручение утверждено', 'Ответственный и срок записаны в реестр', 'success');
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'unassigned') return isUnassignedOrUndated(t);
    return t.status === filterStatus;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addTask({
      title: newTitle,
      assigneeName: newAssignee || 'Не назначен',
      deadline: newDeadline || 'Бессрочно',
      sourceQuote: 'Создано вручную',
      status: 'active'
    });

    setNewTitle('');
    setNewAssignee('');
    setNewDeadline('');
    setIsModalOpen(false);
    showToast('Поручение создано', 'Задача добавлена в реестр', 'success');
  };

  const handleCopyTasksToClipboard = () => {
    if (tasks.length === 0) {
      showToast('Нет задач', 'В реестре пока нет поручений для копирования', 'info');
      return;
    }
    const text = filteredTasks
      .map(
        (t, idx) =>
          `${idx + 1}. [${t.status === 'completed' ? 'Исполнено' : t.status === 'overdue' ? 'ПРОСРОЧЕНО' : 'В работе'}] ${t.title}\n   Исполнитель: ${t.assigneeName} | Срок: ${t.deadline}`
      )
      .join('\n\n');
    navigator.clipboard.writeText(`РЕЕСТР ПОРУЧЕНИЙ (Всего: ${filteredTasks.length})\n\n${text}`);
    showToast('Задачи скопированы', 'Список поручений сохранен в буфер обмена', 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between bg-white dark:bg-[#13151b] shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
            <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight">
              Реестр поручений и задач
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Контроль исполнения решений, предложение ответственного и срока, закрытие обязательств
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyTasksToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-white dark:bg-[#161820] hover:bg-neutral-100 dark:hover:bg-[#1f232e] rounded-md transition-colors border border-neutral-200 dark:border-[#282d3b] shadow-sm"
            title="Скопировать список задач в буфер обмена"
          >
            <Copy className="w-3.5 h-3.5 text-neutral-500" />
            <span>Скопировать реестр</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d25] dark:hover:bg-[#252936] rounded-md transition-colors border border-neutral-200 dark:border-[#282d3b]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Новое поручение</span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge_base')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm"
          >
            <span>Перейти к базе знаний</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Assistant Banner: Detection of Tasks without Owner or Deadline */}
      {unassignedTasks.length > 0 && (
        <div className="px-6 py-3 bg-amber-500/[0.08] border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-950 dark:text-amber-200">
                Обнаружены поручения без ответственного или срока ({unassignedTasks.length}):
              </span>
              <span className="text-neutral-600 dark:text-neutral-300 ml-1.5">
                AI может проанализировать контекст и предложить оптимального исполнителя и дедлайн.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateSuggestions}
              className="px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Предложить ответственного и срок</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="p-3.5 px-6 border-b border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b] shrink-0">
        <div className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'all', label: 'Все поручения' },
              { id: 'unassigned', label: 'Без владельца / срока', badge: unassignedTasks.length },
              { id: 'active', label: 'В работе' },
              { id: 'overdue', label: 'Просроченные', badge: tasks.filter(t => t.status === 'overdue').length, badgeColor: 'bg-rose-500' },
              { id: 'completed', label: 'Завершенные' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                  filterStatus === tab.id
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                    : 'bg-neutral-50 dark:bg-[#191c24] text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white border border-neutral-200/80 dark:border-[#242834]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded text-white text-[10px] font-mono font-bold ${tab.badgeColor || 'bg-amber-500'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="w-72 relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по исполнителю или задаче..."
              className="w-full bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#252936] rounded-md pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400 dark:text-neutral-500 bg-white dark:bg-[#14161c] border border-dashed border-neutral-200 dark:border-[#222631] rounded-lg">
              Поручений в выбранной категории не найдено
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              const isOverdue = task.status === 'overdue' && !isDone;
              const hasNoOwner = isUnassignedOrUndated(task);
              const suggestion = aiSuggestions[task.id];

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border flex flex-col gap-2.5 transition-colors ${
                    isDone
                      ? 'bg-neutral-50/60 dark:bg-[#111317] border-neutral-200/70 dark:border-[#1d2028] opacity-60'
                      : isOverdue
                      ? 'bg-white dark:bg-[#14161c] border-neutral-200 dark:border-[#222631] border-l-4 border-l-rose-500'
                      : hasNoOwner
                      ? 'bg-white dark:bg-[#14161c] border-amber-300 dark:border-amber-800/80 border-l-4 border-l-amber-500'
                      : 'bg-white dark:bg-[#14161c] border-neutral-200 dark:border-[#222631] hover:border-neutral-300 dark:hover:border-[#2c3240]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleTaskStatus(task.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          isDone
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-[#1a1d25] hover:border-sky-500'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${isDone ? 'line-through text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                            {task.title}
                          </span>

                          {hasNoOwner && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30">
                              Требует назначения
                            </span>
                          )}

                          {isOverdue && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold border border-rose-500/30">
                              Просрочено
                            </span>
                          )}
                        </div>

                        {task.sourceQuote && (
                          <div className="text-[11px] text-neutral-500 italic line-clamp-1">
                            «{task.sourceQuote}»
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono pt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <User className="w-3 h-3 text-neutral-400" />
                            {task.assigneeName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            Дедлайн: {task.deadline}
                          </span>
                          {task.meetingTitle && (
                            <span className="text-neutral-400 truncate">
                              Встреча: {task.meetingTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-neutral-400 hover:text-rose-500 p-1.5 rounded transition-colors shrink-0"
                      title="Удалить поручение"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* AI Suggestion Card for Scenario 4 */}
                  {suggestion && (
                    <div className="mt-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-300 dark:border-sky-800 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-150">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          <span className="font-bold text-sky-950 dark:text-sky-200">
                            AI-Предложение: {suggestion.assignee}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-200/60 dark:bg-sky-800/60 text-sky-900 dark:text-sky-100 font-semibold">
                            Срок: {suggestion.deadline}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
                          {suggestion.reason}
                        </div>
                      </div>

                      <button
                        onClick={() => handleConfirmSuggestion(task.id)}
                        className="px-3 py-1.5 rounded text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Подтвердить и записать в реестр</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white">Новое поручение</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300">Название задачи</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Например: Проверить натяжение ремней ламинатора"
                  className="w-full mt-1 bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#262b3a] rounded p-2 text-neutral-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300">Ответственный</label>
                <input
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Иванов И.С. или оставить пустым"
                  className="w-full mt-1 bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#262b3a] rounded p-2 text-neutral-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300">Срок (дедлайн)</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full mt-1 bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#262b3a] rounded p-2 text-neutral-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#1a1d25]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-white bg-neutral-950 dark:bg-white dark:text-neutral-950 font-semibold"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
