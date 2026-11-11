import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_DOCUMENTS } from '../mock/mockData';
import { RAGMessage } from '../types';
import {
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const KnowledgeBaseView: React.FC = () => {
  const { currentRole, currentUser, canAccessDocument, logAudit, showToast, queryRAG } = useApp();

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<RAGMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Здравствуйте, ${currentUser.name}! Задайте вопрос по внутренним регламентам, допускам брака или стандартам клиентского сервиса picPac.by.`,
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
      label: 'Финансы (Тест RBAC): План выручки на Q4',
      text: 'Какой плановый бюджет выручки и фонд премирования заложен на 4 квартал 2026 года?',
    },
    {
      label: 'Клиенты: Перепечатка брака в picPac.by',
      text: 'В какой срок служба заботы обязана ответить клиенту и как оформить экспресс-перепечатку брака?',
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

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-8 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-white/60 dark:bg-[#0c1017]/60 backdrop-blur-xl shrink-0">
        <div>
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">База знаний и регламенты</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Поиск информации по стандартам компании с указанием первоисточника
          </p>
        </div>

        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono bg-white/60 dark:bg-white/[0.04] px-3 py-1 rounded-lg border border-black/[0.05] dark:border-white/[0.06]">
          {MOCK_DOCUMENTS.length} регламентов доступно
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-8 space-y-5 max-w-3xl mx-auto w-full">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed transition-all ${
                msg.sender === 'user'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium shadow-sm'
                  : msg.status === 'access_denied'
                  ? 'bg-rose-500/[0.06] dark:bg-rose-950/25 border border-rose-300 dark:border-rose-900/50 text-rose-950 dark:text-rose-200 backdrop-blur-md'
                  : 'glass-card text-neutral-800 dark:text-neutral-200 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Citations Box */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
                  <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Основание:</div>

                  {msg.citations.map((c) => {
                    const isExpanded = expandedDocId === c.documentId;
                    return (
                      <div
                        key={c.documentId}
                        className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] rounded-xl p-3 text-xs text-neutral-800 dark:text-neutral-300 transition-colors"
                      >
                        <div
                          onClick={() => setExpandedDocId(isExpanded ? null : c.documentId)}
                          className="flex items-center justify-between cursor-pointer hover:text-black dark:hover:text-white transition-colors font-medium"
                        >
                          <span>📄 {c.documentTitle}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>

                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">Редакция от {c.documentDate}</div>

                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06] text-xs text-neutral-700 dark:text-neutral-300 italic bg-white/70 dark:bg-black/30 p-2.5 rounded-lg">
                            «{c.excerpt}»
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 px-1 font-mono">{msg.timestamp}</div>
          </div>
        ))}
      </div>

      {/* Bottom Search Bar & Quick Prompts */}
      <div className="p-6 border-t border-black/[0.06] dark:border-white/[0.08] bg-white/60 dark:bg-[#0c1017]/60 backdrop-blur-xl shrink-0">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Quick Prompts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0 font-medium">Примеры:</span>
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleAsk(sq.text)}
                className="px-3 py-1 glass-card hover:bg-white dark:hover:bg-white/[0.1] rounded-full text-xs text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-all shrink-0 shadow-sm"
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
              placeholder="Спросите ассистента о регламентах, техкартах или планах..."
              className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-blue-500/50 shadow-sm"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isLoading ? 'Поиск...' : 'Спросить'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
