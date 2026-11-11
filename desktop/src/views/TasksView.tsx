import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckSquare, Search, Plus, CheckCircle2, Calendar } from 'lucide-react';

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

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden transition-colors">
      {/* Header */}
      <div className="h-16 px-8 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-white/60 dark:bg-[#0c1017]/60 backdrop-blur-xl shrink-0">
        <div>
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            Реестр поручений
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Контроль исполнения решений, зафиксированных на совещаниях
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Новое поручение</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="p-4 px-8 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-4 bg-white/40 dark:bg-black/[0.1] backdrop-blur-md shrink-0">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: 'Все' },
            { id: 'active', label: 'В работе' },
            { id: 'overdue', label: 'Просроченные' },
            { id: 'completed', label: 'Завершенные' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterStatus === tab.id
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-sm'
                  : 'glass-card text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {tab.label}
              {tab.id === 'overdue' && tasks.filter((t) => t.status === 'overdue').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold">
                  {tasks.filter((t) => t.status === 'overdue').length}
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
            placeholder="Поиск по поручениям..."
            className="w-full glass-input rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-blue-500/50 shadow-sm"
          />
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500 dark:text-neutral-400 glass-card rounded-2xl">
            Нет поручений в этой категории
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl flex items-start gap-3.5 transition-all duration-150 ${
                  isDone
                    ? 'glass-card opacity-55'
                    : 'glass-card hover:border-black/15 dark:hover:border-white/20 hover:-translate-y-0.5 shadow-sm'
                }`}
              >
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    isDone
                      ? 'bg-emerald-600 border-emerald-600 text-white dark:bg-white dark:border-white dark:text-neutral-950'
                      : 'border-black/20 dark:border-white/20 bg-white/70 dark:bg-black/30 hover:border-black/40'
                  }`}
                >
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-sm font-medium ${
                        isDone ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-200'
                      }`}
                    >
                      {task.title}
                    </div>
                    {task.status === 'overdue' && !isDone && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono uppercase">
                        Просрочено
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="text-neutral-700 dark:text-neutral-300 font-medium">👤 {task.assigneeName}</span>
                    <span className={`flex items-center gap-1 ${task.status === 'overdue' && !isDone ? 'text-rose-600 dark:text-rose-400 font-semibold font-mono' : ''}`}>
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      Срок: {task.deadline}
                    </span>
                    {task.meetingTitle && (
                      <span className="text-neutral-500 dark:text-neutral-400">Совещание: {task.meetingTitle}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Новое поручение</h3>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1 font-medium">Формулировка задачи:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Что необходимо сделать..."
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1 font-medium">Ответственный:</label>
                <input
                  type="text"
                  required
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Иванов И.С. (Начальник производства)"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1 font-medium">Срок исполнения:</label>
                <input
                  type="text"
                  required
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  placeholder="2026-11-20"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 rounded-xl text-xs font-semibold hover:bg-black dark:hover:bg-neutral-100 transition-all shadow-sm"
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
