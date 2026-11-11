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
  const { currentRole, currentUser, canAccessDocument, logAudit, showToast } = useApp();

  const [inputQuery, setInputQuery] = useState('');
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

  const handleAsk = (queryText: string) => {
    if (!queryText.trim()) return;

    const userMessage: RAGMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');

    setTimeout(() => {
      generateResponse(queryText);
    }, 400);
  };

  const generateResponse = (q: string) => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const lower = q.toLowerCase();

    // 1. Finance & Budget Question (Clearance Level 1)
    if (lower.includes('бюджет') || lower.includes('выручк') || lower.includes('оклад') || lower.includes('премирован')) {
      if (!canAccessDocument(1)) {
        logAudit(
          'ACCESS_DENIED',
          'Document: doc-fin-01',
          'ACCESS_DENIED',
          `Попытка запроса финансовых показателей пользователем с ролью ${currentRole}`
        );
        showToast('Ограничение доступа', 'Финансовые документы доступны только Генеральному директору', 'warning');

        setMessages((prev) => [
          ...prev,
          {
            id: 'asst-' + Date.now(),
            sender: 'assistant',
            text: `Доступ к документу ограничен.\n\nЗапрашиваемый финансовый отчет относится к Уровню допуска 1 (Генеральный директор). Ваша текущая роль («${currentUser.roleTitle}») не имеет прав на чтение финансово-кадровой тайны компании.\n\n💡 Нажмите кнопку выхода в левом нижнем углу и войдите как Генеральный директор для проверки.`,
            timestamp: time,
            status: 'access_denied',
          },
        ]);
        return;
      }

      // Director has access
      logAudit('RAG_SEARCH', 'Document: doc-fin-01', 'SUCCESS', 'Поиск в финансовых регламентах с цитированием');

      setMessages((prev) => [
        ...prev,
        {
          id: 'asst-' + Date.now(),
          sender: 'assistant',
          text: 'Согласно утвержденному Бюджету доходов и расходов (БДР) на Q4 2026, плановая выручка ООО «Фотопринт» составляет 48 500 000 руб. Плановый фонд премирования производственной смены при соблюдении уровня брака ниже 2.5% составляет 3 200 000 руб.',
          timestamp: time,
          status: 'grounded',
          citations: [
            {
              documentId: 'doc-fin-01',
              documentTitle: 'Бюджет доходов и расходов ООО «Фотопринт» на 4 квартал 2026',
              documentDate: '2026-10-01',
              category: 'Финансы и стратегия',
              excerpt:
                'Плановые показатели выручки ООО «Фотопринт» на Q4 2026 установлены на уровне 48 500 000 руб. Фонд премирования производственной смены составляет 3 200 000 руб. при выполнении норматива брака ниже 2.5%.',
            },
          ],
        },
      ]);
      return;
    }

    // 2. Technical / Production Question
    if (lower.includes('delta-e') || lower.includes('indigo') || lower.includes('отклонен')) {
      logAudit('RAG_SEARCH', 'Document: doc-prod-01', 'SUCCESS', 'Поиск по техкарте HP Indigo');

      setMessages((prev) => [
        ...prev,
        {
          id: 'asst-' + Date.now(),
          sender: 'assistant',
          text: 'По технологической карте ЦПМ HP Indigo 7900 максимально допустимое оптическое отклонение Delta-E составляет не более 2.0. Калибровка встроенного спектрофотометра проводится каждые 4 часа работы либо при замене рулона бумаги. Допустимое смещение приводки — 0.2 мм.',
          timestamp: time,
          status: 'grounded',
          citations: [
            {
              documentId: 'doc-prod-01',
              documentTitle: 'Технологическая карта цифровой печати на ЦПМ HP Indigo 7900',
              documentDate: '2026-08-15',
              category: 'Производство',
              excerpt:
                'Калибровка спектрофотометра выполняется каждые 4 часа непрерывной работы. Допустимое оптическое отклонение Delta-E <= 2.0. Максимальное смещение приводки сторон — 0.2 мм.',
            },
          ],
        },
      ]);
      return;
    }

    // 3. Customer Service Question
    if (lower.includes('перепечатк') || lower.includes('picpac') || lower.includes('брак') || lower.includes('срок')) {
      logAudit('RAG_SEARCH', 'Document: doc-sup-01', 'SUCCESS', 'Поиск по регламенту сервиса PicPac');

      setMessages((prev) => [
        ...prev,
        {
          id: 'asst-' + Date.now(),
          sender: 'assistant',
          text: 'Служба заботы обязана зафиксировать претензию и направить ответ клиенту в течение 15 минут. Если подтвержден производственный брак, заказ направляется на бесплатную экспресс-перепечатку со сроком изготовления до 24 часов.',
          timestamp: time,
          status: 'grounded',
          citations: [
            {
              documentId: 'doc-sup-01',
              documentTitle: 'Регламент обработки рекламаций клиентов сервиса picPac.by',
              documentDate: '2026-08-01',
              category: 'Клиентский сервис',
              excerpt:
                'Оператор поддержки обязан зафиксировать фото дефекта и направить ответ клиенту в течение 15 минут. При подтверждении брака заказ направляется на бесплатную внеочередную перепечатку со сроком до 24 часов.',
            },
          ],
        },
      ]);
      return;
    }

    // 4. Default: Fact not found (Anti-hallucination)
    setMessages((prev) => [
      ...prev,
      {
        id: 'asst-' + Date.now(),
        sender: 'assistant',
        text: 'В доступных регламентах компании «Фотопринт» информация по этому вопросу не найдена.\n\nСтатус: Требует уточнения (AI-05).',
        timestamp: time,
        status: 'needs_clarification',
      },
    ]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-8 border-b border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between bg-white dark:bg-neutral-900/40">
        <div>
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">База знаний и регламенты</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Поиск информации по стандартам компании с указанием первоисточника
          </p>
        </div>

        <div className="text-xs text-neutral-500 dark:text-neutral-400">
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
              className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 font-medium shadow-sm'
                  : msg.status === 'access_denied'
                  ? 'bg-amber-50 dark:bg-neutral-900 border border-amber-300 dark:border-neutral-700 text-amber-900 dark:text-neutral-300'
                  : 'bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Citations Box */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                  <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Основание:</div>

                  {msg.citations.map((c) => {
                    const isExpanded = expandedDocId === c.documentId;
                    return (
                      <div
                        key={c.documentId}
                        className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 text-xs text-neutral-800 dark:text-neutral-300"
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
                          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800/80 text-xs text-neutral-700 dark:text-neutral-300 italic bg-white dark:bg-neutral-900/50 p-2.5 rounded">
                            «{c.excerpt}»
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">{msg.timestamp}</div>
          </div>
        ))}
      </div>

      {/* Bottom Search Bar & Quick Prompts */}
      <div className="p-6 border-t border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/30">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Quick Prompts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">Примеры:</span>
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleAsk(sq.text)}
                className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 border border-neutral-200 dark:border-neutral-700 rounded-full text-xs text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors shrink-0"
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
              className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500 shadow-sm"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-neutral-900 hover:bg-black dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Спросить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
