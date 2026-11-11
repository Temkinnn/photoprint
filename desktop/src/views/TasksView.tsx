import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckSquare, Search, Plus, CheckCircle2, Calendar, Trash2 } from 'lucide-react';

export const TasksView: React.FC = () => {
  const { tasks, toggleTaskStatus, addTask, deleteTask, showToast } = useApp();

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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-hidden transition-colors">
      {/* Header */}
      <div className="h-16 px-6 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between bg-white dark:bg-[#13151b] shrink-0">
        <div>
          <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight flex items-center gap-2">
            Реестр поручений и решений
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Контроль исполнения производственных и организационных решений
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 rounded-md transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Новое поручение</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-3.5 px-6 border-b border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b] shrink-0">
        <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'Все поручения' },
              { id: 'active', label: 'В работе' },
              { id: 'overdue', label: 'Просроченные' },
              { id: 'completed', label: 'Завершенные' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  filterStatus === tab.id
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                    : 'bg-neutral-50 dark:bg-[#191c24] text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white border border-neutral-200/80 dark:border-[#242834]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === 'overdue' && tasks.filter(t => t.status === 'overdue').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[10px] font-mono font-bold">
                    {tasks.filter(t => t.status === 'overdue').length}
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
              placeholder="Поиск по исполнителю или названию..."
              className="w-full bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#252936] rounded-md pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-5xl mx-auto w-full space-y-2.5">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400 dark:text-neutral-500 bg-white dark:bg-[#14161c] border border-dashed border-neutral-200 dark:border-[#222631] rounded-lg">
              Поручений в выбранной категории нет
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              const isOverdue = task.status === 'overdue' && !isDone;

              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-lg border flex items-start gap-3 transition-colors ${
                    isDone
                      ? 'bg-neutral-50/60 dark:bg-[#111317] border-neutral-200/70 dark:border-[#1d2028] opacity-60'
                      : isOverdue
                      ? 'bg-white dark:bg-[#14161c] border-neutral-200 dark:border-[#222631] border-l-4 border-l-rose-500'
                      : 'bg-white dark:bg-[#14161c] border-neutral-200 dark:border-[#222631] hover:border-neutral-300 dark:hover:border-[#2c3240]'
                  }`}
                >
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

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-xs font-medium leading-snug ${
                          isDone ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {task.title}
                      </div>
                      {isOverdue && (
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 uppercase shrink-0">
                          Просрочено
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                        {task.assigneeName}
                      </span>
                      <span className={`font-mono ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-neutral-500'}`}>
                        Срок: {task.deadline}
                      </span>
                      {task.meetingTitle && (
                        <span className="text-neutral-400 font-mono text-[10px]">
                          [{task.meetingTitle}]
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTask(task.id)}
                    title="Удалить поручение из реестра"
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 p-1.5 transition-all rounded hover:bg-neutral-100 dark:hover:bg-[#1a1d25] shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Новое поручение</h3>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">Формулировка задачи:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Что необходимо сделать..."
                  className="w-full bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-300 dark:border-[#282d3b] rounded-md p-2.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">Ответственный:</label>
                <input
                  type="text"
                  required
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Иванов И.С. (Начальник производства)"
                  className="w-full bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-300 dark:border-[#282d3b] rounded-md p-2.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">Срок исполнения:</label>
                <input
                  type="text"
                  required
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  placeholder="2026-11-20"
                  className="w-full bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-300 dark:border-[#282d3b] rounded-md p-2.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-[#222631]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-md text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
