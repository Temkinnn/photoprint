import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckSquare, Search, Plus, CheckCircle2, Calendar } from 'lucide-react';

export const TasksView: React.FC = () => {
  const { tasks, toggleTaskStatus, addTask, showToast } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  const filteredTasks = tasks.filter((t) => {
    const matchesQuery =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'all') return matchesQuery;
    return matchesQuery && t.status === filterStatus;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addTask({
      title: newTitle,
      assigneeName: newAssignee || 'Не назначен',
      deadline: newDeadline || 'Бессрочно',
      sourceQuote: 'Создано вручную в реестре задач',
      status: 'active',
    });

    setNewTitle('');
    setNewAssignee('');
    setNewDeadline('');
    setIsAddModalOpen(false);
    showToast('Поручение создано', 'Новая задача успешно зафиксирована в реестре', 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-200">
            Единый реестр поручений и контроль исполнения
          </span>
          <span className="text-[10px] text-slate-400 font-mono">({tasks.length} задач)</span>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Новое поручение
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/20">
        <div className="flex items-center gap-2">
          {['all', 'active', 'completed', 'overdue'].map((st) => {
            const labels: Record<string, string> = {
              all: 'Все',
              active: 'В работе',
              completed: 'Завершенные',
              overdue: 'Просроченные',
            };
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  filterStatus === st
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>

        <div className="w-72 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или исполнителю..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Task List Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-2.5">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
              Поручения, соответствующие фильтрам, не найдены
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              const isOverdue = task.status === 'overdue';

              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-4 transition-all ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : isOverdue
                      ? 'bg-rose-950/15 border-rose-900/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => toggleTaskStatus(task.id)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isDone
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-slate-700 bg-slate-950 hover:border-blue-500'
                      }`}
                    >
                      {isDone && <CheckCircle2 className="w-3 h-3" />}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div
                        className={`text-xs font-semibold ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-100'
                        }`}
                      >
                        {task.title}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-slate-300">
                          👤 {task.assigneeName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Срок: {task.deadline}
                        </span>
                        {task.meetingTitle && (
                          <span className="text-blue-400 flex items-center gap-1">
                            📋 Совещание: {task.meetingTitle}
                          </span>
                        )}
                      </div>

                      {task.sourceQuote && (
                        <div className="text-[10px] text-slate-400 italic pt-1">
                          Основание: «{task.sourceQuote}»
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {isDone ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ВЫПОЛНЕНО
                      </span>
                    ) : isOverdue ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        ПРОСРОЧЕНО
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        В РАБОТЕ
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="text-sm font-semibold text-slate-100">Создание нового поручения</div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Формулировка задачи:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Например: Проверить натяжение ремней ламинатора"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Ответственный (ФИО / Должность):</label>
                <input
                  type="text"
                  required
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Иванов И.С. (Начальник цеха)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Срок исполнения:</label>
                <input
                  type="text"
                  required
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  placeholder="2026-11-20"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Сохранить поручение
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
