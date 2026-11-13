// ======================== src/views/TasksView.tsx ========================
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, CheckCircle2, X } from 'lucide-react';

export const TasksView: React.FC = () => {
  const { tasks, toggleTaskStatus, addTask, showToast } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && t.status === filterStatus;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addTask({
      title: newTitle,
      assigneeName: newAssignee || 'Не назначен',
      deadline: newDeadline || 'Бессрочно',
      sourceQuote: 'Создано вручную',
      status: 'active',
    });

    setNewTitle('');
    setNewAssignee('');
    setNewDeadline('');
    setIsModalOpen(false);
    showToast('Поручение создано', 'Задача добавлена в реестр', 'success');
  };

  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden transition-colors">
      <div className="h-16 px-6 border-b border-[var(--border-solid)] bg-[var(--bg-card)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">
            Реестр поручений и решений
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Контроль исполнения производственных и организационных задач
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 rounded-lg transition-opacity"
        >
          <Plus className="w-4 h-4" />
          <span>Новое поручение</span>
        </button>
      </div>

      <div className="px-6 py-3 border-b border-[var(--border-solid)] bg-[var(--bg-card)] shrink-0">
        <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-solid)] gap-1">
            {[
              { id: 'all', label: 'Все', count: tasks.length },
              {
                id: 'active',
                label: 'В работе',
                count: tasks.filter((t) => t.status === 'active').length,
              },
              { id: 'overdue', label: 'Просроченные', count: overdueCount, alert: overdueCount > 0 },
              {
                id: 'completed',
                label: 'Завершенные',
                count: tasks.filter((t) => t.status === 'completed').length,
              },
            ].map((tab) => {
              const isActive = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[11px] px-1.5 rounded ${
                      tab.alert
                        ? 'bg-[#D71921] text-white'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-72 relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по исполнителю или задаче..."
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)]"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-5xl mx-auto w-full space-y-2.5">
          {filteredTasks.length === 0 ? (
            <div className="nothing-card-dashed py-12 text-center text-xs text-[var(--text-muted)]">
              Поручений в выбранной категории нет
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              const isOverdue = task.status === 'overdue' && !isDone;

              return (
                <div
                  key={task.id}
                  className={`nothing-card p-4 flex items-start gap-3.5 transition-opacity ${
                    isDone ? 'opacity-55' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    title={isDone ? 'Вернуть в работу' : 'Отметить выполненным'}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-[var(--border-dashed)] bg-[var(--bg-elevated)] hover:border-[var(--text-primary)]'
                    }`}
                  >
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className={`text-xs font-semibold leading-snug ${
                          isDone
                            ? 'line-through text-[var(--text-muted)]'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {task.title}
                      </div>

                      {isDone ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Выполнено
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#D71921]/15 text-[#D71921]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                          Просрочено
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                          В работе
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--text-primary)]">
                        {task.assigneeName}
                      </span>
                      <span
                        className={`font-mono text-[11px] ${
                          isOverdue ? 'text-[#D71921] font-medium' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        Срок: {task.deadline}
                      </span>
                      {task.meetingTitle && (
                        <span className="text-[var(--text-muted)] font-mono text-[11px]">
                          {task.meetingTitle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="nothing-card max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-solid)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Новое поручение
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Формулировка задачи
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Что необходимо сделать..."
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Ответственный
                </label>
                <input
                  type="text"
                  required
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Иванов И.С. (Начальник производства)"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                  Срок исполнения
                </label>
                <input
                  type="text"
                  required
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  placeholder="2026-11-20"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--border-solid)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-canvas)] rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Сохранить в реестр
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};