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
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden transition-colors">
      {/* Header */}
      <div className="h-16 px-8 border-b border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between bg-white dark:bg-neutral-900/40">
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
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Новое поручение
        </button>
      </div>

      {/* Filter and Search */}
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between gap-4 bg-white/50 dark:bg-neutral-900/10">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'Все' },
            { id: 'active', label: 'В работе' },
            { id: 'overdue', label: 'Просроченные' },
            { id: 'completed', label: 'Завершенные' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === tab.id
                  ? 'bg-neutral-900 text-white dark:bg-neutral-800 dark:text-white font-semibold shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              {tab.label}
              {tab.id === 'overdue' && tasks.filter(t => t.status === 'overdue').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold">
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
            placeholder="Поиск по поручениям..."
            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 shadow-sm"
          />
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500 dark:text-neutral-400">Нет поручений в этой категории</div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border flex items-start gap-3.5 transition-colors shadow-sm ${
                  isDone
                    ? 'bg-neutral-100/50 dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800/60 opacity-60'
                    : 'bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isDone
                      ? 'bg-emerald-600 border-emerald-600 text-white dark:bg-neutral-100 dark:border-neutral-100 dark:text-neutral-950'
                      : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:border-neutral-500'
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
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
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
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
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
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
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 rounded-lg text-xs font-semibold hover:bg-black dark:hover:bg-white transition-colors"
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
