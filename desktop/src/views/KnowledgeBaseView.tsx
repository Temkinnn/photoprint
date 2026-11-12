import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { RAGMessage } from '../types';
import {
  Send,
  ChevronDown,
  ChevronUp,
  FileText,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Copy,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';

export const KnowledgeBaseView: React.FC = () => {
  const { currentRole, currentUser, canAccessDocument, logAudit, showToast, queryRAG, documents, setActiveTab, auditLogs } = useApp();
  const [showDocsList, setShowDocsList] = useState(false);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<RAGMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Здравствуйте, ${currentUser.name}! Задайте вопрос по регламентам, допускам брака или стандартам клиентского сервиса picPac.by.`,
      timestamp: '14:00',
    },
  ]);

  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const sampleQuestions = [
    {
      label: 'Станки: Допуск Delta-E на ЦПМ HP Indigo',
      text: 'Какое допустимое оптическое отклонение Delta-E установлено для цифровой печати на ЦПМ HP Indigo 7900?',
    },
    {
      label: '⛔ Отказ в доступе (RBAC): Зарплата директора',
      text: 'Какая зарплата у генерального директора и сетка премиальных окладов руководства?',
    },
    {
      label: 'Финансы (RBAC): Бюджет и фонд премирования Q4',
      text: 'Какой плановый бюджет выручки и фонд премирования заложен на 4 квартал 2026 года?',
    },
    {
      label: 'Клиенты: Перепечатка брака в picPac.by',
      text: 'В какой срок служба заботы обязана ответить клиенту и как оформить экспресс-перепечатку брака?',
    },
    {
      label: 'AI-05: Нормативы вертолетов (нет данных)',
      text: 'Каковы нормативы посадки вертолетов на крышу полиграфического комплекса ООО Фотопринт?',
    },
  ];

  const handleAsk = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMessage: RAGMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const assistantMessage = await queryRAG(queryText);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'assistant',
          text: 'В доступных регламентах компании «Фотопринт» прямых оснований не найдено (AI-05).',
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          status: 'needs_clarification',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAnswer = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Ответ скопирован', 'Текст ответа сохранен в буфер обмена', 'success');
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: `Здравствуйте, ${currentUser.name}! Задайте вопрос по регламентам, допускам брака или стандартам клиентского сервиса picPac.by.`,
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    showToast('История очищена', 'Диалог с базой знаний сброшен', 'info');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between bg-white dark:bg-[#13151b] shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
            <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight">
              База знаний и регламенты
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Семантический поиск по регламентам, цитирование документов и фрагментов; проверка требований
          </p>
        </div>

        <div className="flex items-center gap-2">
          {auditLogs.some((l) => (l.status || '').toUpperCase() === 'ACCESS_DENIED' || (l.status || '').toUpperCase() === 'BLOCKED' || (l.actionType || '').includes('SECURITY')) && (
            <button
              onClick={() => setActiveTab('audit')}
              className="text-xs font-mono font-medium text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded border border-rose-500/30 flex items-center gap-1.5 transition-colors"
              title="Перейти к журналу аудита нарушений доступа"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>Отказы в аудите</span>
            </button>
          )}

          <button
            onClick={() => setShowDocsList((prev) => !prev)}
            className="text-xs font-mono text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d25] dark:hover:bg-[#242936] px-2.5 py-1.5 rounded border border-neutral-200 dark:border-[#262a36] flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-500" />
            <span>{documents.length} регламентов</span>
          </button>

          {messages.length > 1 && (
            <button
              onClick={handleClearChat}
              className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d25] dark:hover:bg-[#242936] px-2.5 py-1.5 rounded border border-neutral-200 dark:border-[#262a36] flex items-center gap-1.5 transition-colors"
              title="Очистить историю диалога"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Очистить</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm"
          >
            <span>Перейти к пульсу компании</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Optional Documents Explorer Drawer */}
      {showDocsList && (
        <div className="bg-neutral-50 dark:bg-[#111319] border-b border-neutral-200 dark:border-[#212530] p-4 px-6 shrink-0 max-h-48 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 font-semibold uppercase">
              Доступные регламенты ({documents.length}):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {documents.map((doc) => (
                <div key={doc.id} className="p-2 rounded bg-white dark:bg-[#161820] border border-neutral-200/80 dark:border-[#252a38] text-xs">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate" title={doc.title}>
                    {doc.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between mt-1 font-mono">
                    <span>{doc.category}</span>
                    <span>{doc.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-lg p-4 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-neutral-950 text-white dark:bg-[#1e222d] dark:text-white font-medium'
                  : msg.status === 'access_denied'
                  ? 'bg-rose-50/80 dark:bg-[#1c0f13] border-2 border-rose-400 dark:border-rose-900/80 text-rose-950 dark:text-rose-100 shadow-sm'
                  : 'bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] text-neutral-900 dark:text-neutral-200'
              }`}
            >
              {msg.status === 'access_denied' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 font-medium">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
                      <span className="font-bold text-[11px] uppercase tracking-wide">
                        Отказ в доступе (Политика безопасности RBAC AI-02)
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold transition-colors shrink-0 shadow-sm flex items-center gap-1"
                    >
                      <span>Журнал аудита</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              )}

              {/* Citations Box */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-[#1e222c] space-y-2">
                  <div className="text-[11px] font-mono font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Основание в регламентах:
                  </div>

                  {msg.citations.map((c) => {
                    const isExpanded = expandedDocId === c.documentId;
                    return (
                      <div
                        key={c.documentId}
                        className="bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#202430] rounded-md p-3 text-xs text-neutral-800 dark:text-neutral-300"
                      >
                        <div
                          onClick={() => setExpandedDocId(isExpanded ? null : c.documentId)}
                          className="flex items-center justify-between cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors font-medium"
                        >
                          <span className="font-semibold">{c.documentTitle}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>

                        <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                          Редакция от {c.documentDate} · {c.documentId}
                        </div>

                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-neutral-200/80 dark:border-[#1d2028] text-xs text-neutral-700 dark:text-neutral-300 italic bg-white dark:bg-[#14161c] p-2.5 rounded border border-neutral-100 dark:border-[#1e222c]">
                            «{c.excerpt}»
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-[10px] font-mono text-neutral-400 mt-1 px-1">
              <span>{msg.timestamp}</span>
              {msg.sender === 'assistant' && (
                <button
                  onClick={() => handleCopyAnswer(msg.text)}
                  className="hover:text-sky-500 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Скопировать текст ответа"
                >
                  <Copy className="w-3 h-3 text-neutral-400 hover:text-sky-500" />
                  <span>Копировать</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Search Bar & Quick Prompts */}
      <div className="p-4 px-6 border-t border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#13151b]">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {/* Quick Prompts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-mono text-neutral-400 shrink-0">Запросы:</span>
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleAsk(sq.text)}
                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d25] dark:hover:bg-[#222632] border border-neutral-200/80 dark:border-[#282d3a] rounded text-[11px] text-neutral-700 dark:text-neutral-300 transition-colors shrink-0"
              >
                {sq.label}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(inputQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Вопрос по стандартам, браку, допускам Delta-E или регламентам цеха..."
              className="flex-1 bg-neutral-50 dark:bg-[#181a22] border border-neutral-200 dark:border-[#282d3a] rounded-md px-3.5 py-2 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold rounded-md transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Запросить</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
