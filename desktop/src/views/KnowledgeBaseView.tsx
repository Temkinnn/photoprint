import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  DocumentDiffLine,
  DocumentItem,
  DocumentVersionItem,
  RAGMessage,
} from '../types';
import {
  Send,
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
  Plus,
  Edit3,
  Cpu,
  History,
  CheckCircle2,
  X,
  RotateCcw,
  Shield,
  GitCompare,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';

const CLEARANCE_LABELS: Record<number, string> = {
  1: 'LVL-1 · ДИРЕКТОР',
  2: 'LVL-2 · ЦЕХ + ДИРЕКТОР',
  3: 'LVL-3 · ОБЩИЙ ДОСТУП',
};

interface EditorDraftState {
  mode: 'create' | 'edit';
  documentId: string | null;
  originalTitle: string;
  originalContent: string;
  title: string;
  category: string;
  minClearance: number;
  summary: string;
  content: string;
  changeNote: string;
  diffLines: DocumentDiffLine[];
  modelUsed?: string;
}

export const KnowledgeBaseView: React.FC = () => {
  const {
    queryRAG,
    documents,
    ragMessages,
    setRagMessages,
    currentRole,
    showToast,
    logAudit,
    getDocumentVersions,
    generateDocumentDraft,
    previewDocumentDiff,
    commitDocument,
    rollbackDocumentVersion,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'rag' | 'docs'>('rag');
  const [inputQuery, setInputQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'production' | 'service' | 'finance'>(
    'all'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  // Document Registry, Diff Preview & Versioning
  const [docSearch, setDocSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [aiInstruction, setAiInstruction] = useState('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [draft, setDraft] = useState<EditorDraftState | null>(null);

  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [compareVersion, setCompareVersion] = useState<DocumentVersionItem | null>(null);
  const [compareDiffLines, setCompareDiffLines] = useState<DocumentDiffLine[]>([]);

  const roleMinClearance =
    currentRole === 'ROLE_DIRECTOR' ? 1 : currentRole === 'ROLE_PRODUCTION_HEAD' ? 2 : 3;

  const filteredDocs = documents.filter((d) => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q)
    );
  });

  const selectedDoc: DocumentItem | null =
    documents.find((d) => d.id === selectedDocId) || filteredDocs[0] || null;

  useEffect(() => {
    if (!selectedDoc && documents.length > 0) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDoc]);

  const loadVersionsForDoc = async (docId: string) => {
    setIsLoadingVersions(true);
    try {
      const list = await getDocumentVersions(docId);
      setVersions(list);
    } catch (err: any) {
      setVersions([]);
      showToast('История версий', err?.message || 'Не удалось загрузить версии', 'warning');
    } finally {
      setIsLoadingVersions(false);
    }
  };

  useEffect(() => {
    setDraft(null);
    setCompareVersion(null);
    setVersions([]);
  }, [currentRole]);

  useEffect(() => {
    if (activeSubTab === 'docs' && showVersions && selectedDoc) {
      loadVersionsForDoc(selectedDoc.id);
    }
  }, [activeSubTab, showVersions, selectedDoc?.id, selectedDoc?.version]);

  const handleOpenNewDocEditor = () => {
    setActiveSubTab('docs');
    setShowVersions(false);
    setCompareVersion(null);
    setDraft({
      mode: 'create',
      documentId: null,
      originalTitle: '',
      originalContent: '',
      title: 'Новый регламент ООО «Фотопринт»',
      category: 'Производство / Качество',
      minClearance: roleMinClearance,
      summary: '',
      content: '1. Общие положения\n2. Требования и допуски\n3. Ответственность исполнителей',
      changeNote: 'Создание первичной редакции v1',
      diffLines: [
        { kind: 'added', text: '1. Общие положения' },
        { kind: 'added', text: '2. Требования и допуски' },
        { kind: 'added', text: '3. Ответственность исполнителей' },
      ],
    });
  };

  const handleStartManualEdit = (doc: DocumentItem) => {
    setShowVersions(false);
    setCompareVersion(null);
    setDraft({
      mode: 'edit',
      documentId: doc.id,
      originalTitle: doc.title,
      originalContent: doc.content,
      title: doc.title,
      category: doc.category,
      minClearance: Math.max(doc.minClearance, roleMinClearance),
      summary: doc.summary,
      content: doc.content,
      changeNote: `Обновление документа «${doc.title}»`,
      diffLines: doc.content.split('\n').map((text) => ({ kind: 'unchanged', text })),
    });
  };

  const handleRefreshDraftDiff = async (currentDraft: EditorDraftState) => {
    try {
      const lines = await previewDocumentDiff(currentDraft.originalContent, currentDraft.content);
      setDraft((prev) => (prev ? { ...prev, diffLines: lines } : prev));
    } catch {
      // ignore transient diff preview failure
    }
  };

  const handleGenerateAiDraft = async (mode: 'create' | 'edit') => {
    if (!aiInstruction.trim()) {
      showToast(
        'Укажите инструкцию',
        'Опишите, что нужно создать или изменить в документе',
        'warning'
      );
      return;
    }
    if (mode === 'edit' && !selectedDoc) return;

    setIsGeneratingDraft(true);
    try {
      const res = await generateDocumentDraft({
        documentId: mode === 'edit' ? selectedDoc?.id : null,
        instruction: aiInstruction.trim(),
        title: draft?.title || (mode === 'edit' ? selectedDoc?.title : undefined),
        category: draft?.category || (mode === 'edit' ? selectedDoc?.category : undefined),
        minClearance:
          draft?.minClearance || (mode === 'edit' ? selectedDoc?.minClearance : roleMinClearance),
      });
      setShowVersions(false);
      setCompareVersion(null);
      setDraft({
        mode: res.mode,
        documentId: res.documentId || null,
        originalTitle: res.originalTitle,
        originalContent: res.originalContent,
        title: res.proposedTitle,
        category: res.proposedCategory,
        minClearance: res.proposedMinClearance,
        summary: res.proposedSummary,
        content: res.proposedContent,
        changeNote: res.changeNote,
        diffLines: res.diffLines,
        modelUsed: res.modelUsed,
      });
      showToast(
        'Черновик готов',
        'Проверьте изменения в Diff-превью и подтвердите сохранение в базу.',
        'info'
      );
    } catch (err: any) {
      showToast(
        'Ошибка генерации',
        err?.message || 'Не удалось сформировать черновик через AI',
        'error'
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleCommitDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      showToast('Заполните поля', 'Заголовок и текст документа не могут быть пустыми', 'warning');
      return;
    }
    setIsCommitting(true);
    try {
      const saved = await commitDocument({
        mode: draft.mode,
        documentId: draft.documentId,
        title: draft.title.trim(),
        category: draft.category.trim() || 'Общие регламенты',
        minClearance: draft.minClearance,
        summary: draft.summary.trim(),
        content: draft.content.trim(),
        changeNote: draft.changeNote.trim(),
      });
      setDraft(null);
      setAiInstruction('');
      setSelectedDocId(saved.id);
      setShowVersions(true);
    } catch (err: any) {
      showToast('Ошибка сохранения', err?.message || 'Не удалось сохранить документ', 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDiscardDraft = () => {
    if (draft) {
      logAudit(
        'REJECT_DOCUMENT_DRAFT',
        draft.documentId ? `${draft.documentId} (${draft.title})` : `Новый: ${draft.title}`,
        'REJECTED',
        'Руководитель отклонил черновик изменений документа до сохранения в БД.'
      );
    }
    setDraft(null);
    showToast('Черновик отменён', 'Изменения не внесены в базу данных', 'info');
  };

  const handleCompareVersion = async (ver: DocumentVersionItem) => {
    if (!selectedDoc) return;
    setCompareVersion(ver);
    const lines = await previewDocumentDiff(ver.content, selectedDoc.content);
    setCompareDiffLines(lines);
  };

  const handleRollback = async (ver: DocumentVersionItem) => {
    if (!selectedDoc) return;
    try {
      await rollbackDocumentVersion(selectedDoc.id, ver.id);
      setCompareVersion(null);
      await loadVersionsForDoc(selectedDoc.id);
    } catch (err: any) {
      showToast('Ошибка отката', err?.message || 'Не удалось выполнить откат версии', 'error');
    }
  };

  const starterScenarios = [
    {
      tag: 'ПРОИЗВОДСТВО · ЦПМ',
      title: 'Допуск Delta-E на HP Indigo 7900',
      description: 'Нормативы оптического отклонения цвета и калибровки печатной машины',
      query:
        'Какое допустимое оптическое отклонение Delta-E установлено для цифровой печати на ЦПМ HP Indigo 7900?',
    },
    {
      tag: 'ФИНАНСЫ · ДОПУСК 1',
      title: 'Бюджет выручки и премий на Q4',
      description: 'Плановые показатели выручки, ФОТ цеха и лимиты согласования платежей',
      query:
        'Какой плановый бюджет выручки и фонд премирования заложен на 4 квартал 2026 года?',
    },
    {
      tag: 'СЕРВИС · PICPAC.BY',
      title: 'Регламент перепечатки брака',
      description: 'Сроки реакции службы заботы и порядок экспресс-перепечатки тиража',
      query:
        'В какой срок служба заботы обязана ответить клиенту и как оформить экспресс-перепечатку брака?',
    },
  ];

  const handleAsk = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const scopeHints: Record<typeof searchScope, string> = {
      all: '',
      production: '[Раздел: Производство и техкарты] ',
      service: '[Раздел: Клиентский сервис picPac.by] ',
      finance: '[Раздел: Финансы и стратегия] ',
    };

    const userMessage: RAGMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setRagMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const assistantMessage = await queryRAG(`${scopeHints[searchScope]}${queryText}`);
      setRagMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setRagMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'assistant',
          text: err?.message || 'Ошибка обращения к локальной базе регламентов.',
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          status: 'needs_clarification',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDocumentFromCitation = (docId: string) => {
    setSelectedDocId(docId);
    setDraft(null);
    setShowVersions(false);
    setActiveSubTab('docs');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-[var(--border-solid)] bg-[var(--bg-card)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="font-dot text-base uppercase tracking-wider text-[var(--text-primary)] truncate">
              БАЗА ЗНАНИЙ И ДОКУМЕНТЫ
            </h1>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              Поиск по регламентам, редактирование с Diff-превью и история версий
            </p>
          </div>

          {/* Segmented Tab Switcher (Affordance Level 2) */}
          <div className="inline-flex items-center p-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] shrink-0">
            <button
              onClick={() => setActiveSubTab('rag')}
              className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                activeSubTab === 'rag'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
              }`}
            >
              RAG-поиск
            </button>
            <button
              onClick={() => setActiveSubTab('docs')}
              className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                activeSubTab === 'docs'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
              }`}
            >
              Документы и версии ({documents.length})
            </button>
          </div>
        </div>

        <button
          onClick={handleOpenNewDocEditor}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Новый документ</span>
        </button>
      </div>

      {activeSubTab === 'rag' ? (
        <>
          {/* RAG Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-3xl mx-auto w-full">
            {/* Starter Scenario Cards when conversation just began */}
            {ragMessages.length <= 1 && (
              <div className="space-y-3 pt-2">
                <div className="font-dot text-[11px] uppercase tracking-widest text-[var(--text-muted)] px-1">
                  ТИПОВЫЕ СЦЕНАРИИ ПОИСКА ПО РЕГЛАМЕНТАМ
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {starterScenarios.map((sc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAsk(sc.query)}
                      className="text-left nothing-card p-4 flex flex-col justify-between gap-3 hover:border-[var(--text-primary)] transition-all group active:scale-[0.99]"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {sc.tag}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[#D71921] transition-colors" />
                        </div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          {sc.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] leading-snug">
                          {sc.description}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--text-primary)] group-hover:text-[#D71921] transition-colors">
                        Запустить запрос →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ragMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-[22px] p-4 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-medium'
                      : msg.status === 'access_denied'
                      ? 'nothing-card border-[#D71921]/50 text-[var(--text-primary)]'
                      : 'nothing-card text-[var(--text-primary)]'
                  }`}
                >
                  {msg.status === 'access_denied' && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D71921]/15 text-[#D71921] font-mono text-[10px] font-bold mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D71921]" />
                      ДОСТУП ОГРАНИЧЕН МАТРИЦЕЙ RBAC
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Citations with Dual Actions: Expand Excerpt + Open Full Document */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-dashed border-[var(--border-dashed)] space-y-2">
                      <div className="font-dot text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                        ОСНОВАНИЕ В РЕГЛАМЕНТАХ
                      </div>

                      {msg.citations.map((c) => {
                        const isExpanded = expandedDocId === c.documentId;
                        return (
                          <div
                            key={c.documentId}
                            className="bg-[var(--bg-elevated)]/80 border border-[var(--border-solid)] rounded-2xl p-3 text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedDocId(isExpanded ? null : c.documentId)}
                                className="text-left flex-1 min-w-0 group"
                              >
                                <div className="font-bold text-[var(--text-primary)] group-hover:text-[#D71921] transition-colors flex items-center gap-1.5">
                                  <span>{c.documentTitle}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                                  Редакция от {c.documentDate} · {c.documentId}
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenDocumentFromCitation(c.documentId)}
                                title="Открыть полный текст документа"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)] text-[var(--text-primary)] transition-colors shrink-0"
                              >
                                <span>Открыть</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="pt-2 border-t border-dashed border-[var(--border-dashed)] text-xs text-[var(--text-secondary)] italic bg-[var(--bg-card)] p-3 rounded-xl">
                                «{c.excerpt}»
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1 px-2">
                  {msg.timestamp}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="nothing-card px-4 py-3 text-xs text-[var(--text-secondary)] font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D71921] animate-ping" />
                  <span>Поиск по регламентам и формирование ответа...</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Search Dock with Embedded Domain Scope Selector */}
          <div className="p-4 px-6 border-t border-dashed border-[var(--border-dashed)] bg-[var(--bg-card)]">
            <div className="max-w-3xl mx-auto space-y-2.5">
              {/* Quick Prompt Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] shrink-0">
                  БЫСТРЫЙ ЗАПРОС:
                </span>
                {starterScenarios.map((sc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAsk(sc.query)}
                    className="px-3 py-1 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-solid)] rounded-full text-[11px] text-[var(--text-primary)] transition-colors shrink-0"
                  >
                    {sc.title}
                  </button>
                ))}
              </div>

              {/* Search Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAsk(inputQuery);
                }}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] focus-within:border-[var(--text-primary)] transition-colors"
              >
                {/* In-Input Scope Selector */}
                <div className="relative flex items-center pl-2 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] mr-1.5" />
                  <select
                    value={searchScope}
                    onChange={(e) => setSearchScope(e.target.value as any)}
                    className="bg-[var(--bg-card)] border border-[var(--border-solid)] rounded-full px-3 py-1 text-[11px] font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer"
                  >
                    <option value="all">Все регламенты ({documents.length})</option>
                    <option value="production">Производство / ЦПМ</option>
                    <option value="service">Клиентский сервис</option>
                    <option value="finance">Финансы (Допуск 1)</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Задайте вопрос по стандартам, допускам Delta-E или регламентам..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none min-w-[200px]"
                />

                <button
                  type="submit"
                  disabled={isLoading || !inputQuery.trim()}
                  className="px-5 py-2 bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-40 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Запросить</span>
                </button>
              </form>
            </div>
          </div>
        </>
      ) : (
        /* Documents, Diff Preview & Version History */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Searchable RBAC Document Registry */}
          <div className="w-80 border-r border-[var(--border-solid)] bg-[var(--bg-card)] flex flex-col shrink-0">
            <div className="p-3.5 border-b border-dashed border-[var(--border-dashed)]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Поиск документа или категории..."
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full pl-9 pr-4 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredDocs.map((doc) => {
                const isSelected = !draft && selectedDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setDraft(null);
                      setCompareVersion(null);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all space-y-1.5 ${
                      isSelected
                        ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-[var(--text-primary)] shadow-sm'
                        : 'bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)] border-[var(--border-solid)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                          isSelected
                            ? 'bg-[#D71921] text-white'
                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                        }`}
                      >
                        v{doc.version || 1}
                      </span>
                      <span
                        className={`text-[10px] font-mono ${
                          isSelected ? 'opacity-75' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {doc.date}
                      </span>
                    </div>
                    <div className="text-xs font-bold leading-snug line-clamp-2">{doc.title}</div>
                    <div
                      className={`text-[10px] font-mono truncate ${
                        isSelected ? 'opacity-80' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {doc.category} · LVL-{doc.minClearance}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Diff Editor OR Document Inspector */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-5">
              {draft ? (
                <div className="space-y-4">
                  {/* Draft Header */}
                  <div className="nothing-card p-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-[#D71921] font-semibold">
                        <span>
                          {draft.mode === 'create'
                            ? 'ЧЕРНОВИК НОВОГО ДОКУМЕНТА (V1)'
                            : `ЧЕРНОВИК ИЗМЕНЕНИЙ (${draft.documentId})`}
                        </span>
                      </div>
                      <h2 className="font-dot text-base uppercase tracking-wider text-[var(--text-primary)] mt-1">
                        ПРЕДПРОСМОТР ИЗМЕНЕНИЙ (DIFF) И ПОДТВЕРЖДЕНИЕ
                      </h2>
                    </div>

                    <button
                      onClick={handleDiscardDraft}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Закрыть черновик</span>
                    </button>
                  </div>

                  {/* AI Refinement Input */}
                  <div className="nothing-card p-4 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      placeholder="Инструкция для AI (напр.: оформи стандарт по новым допускам Delta-E ≤ 1.8)..."
                      className="flex-1 min-w-[240px] bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full px-4 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                    />
                    <button
                      onClick={() => handleGenerateAiDraft(draft.mode)}
                      disabled={isGeneratingDraft || !aiInstruction.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 disabled:opacity-50"
                    >
                      <Cpu className={`w-3.5 h-3.5 ${isGeneratingDraft ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingDraft ? 'Генерация...' : 'Сгенерировать через AI'}</span>
                    </button>
                  </div>

                  {/* Metadata Inputs */}
                  <div className="nothing-card p-5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                        НАЗВАНИЕ ДОКУМЕНТА
                      </label>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full px-4 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                        УРОВЕНЬ ДОСТУПА (RBAC)
                      </label>
                      <select
                        value={draft.minClearance}
                        onChange={(e) =>
                          setDraft({ ...draft, minClearance: Number(e.target.value) })
                        }
                        className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                      >
                        {[1, 2, 3]
                          .filter((lvl) => lvl >= roleMinClearance)
                          .map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {CLEARANCE_LABELS[lvl]}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                        КАТЕГОРИЯ
                      </label>
                      <input
                        type="text"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full px-4 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                        КРАТКАЯ АННОТАЦИЯ
                      </label>
                      <input
                        type="text"
                        value={draft.summary}
                        onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                        placeholder="Краткое описание регламента..."
                        className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full px-4 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                        КОММЕНТАРИЙ К ВЕРСИИ
                      </label>
                      <input
                        type="text"
                        value={draft.changeNote}
                        onChange={(e) => setDraft({ ...draft, changeNote: e.target.value })}
                        className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full px-4 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Side-by-Side Editor & Diff */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="nothing-card p-5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                          РЕДАКТИРУЕМЫЙ ТЕКСТ
                        </span>
                        <button
                          onClick={() => handleRefreshDraftDiff(draft)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                        >
                          <GitCompare className="w-3 h-3 text-[#D71921]" />
                          <span>Обновить Diff</span>
                        </button>
                      </div>
                      <textarea
                        rows={13}
                        value={draft.content}
                        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                        onBlur={() => handleRefreshDraftDiff(draft)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-2xl p-3.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] leading-relaxed resize-y"
                      />
                    </div>

                    <div className="nothing-card p-5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                          DIFF-ПРЕВЬЮ (БЫЛО → СТАЛО)
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          +{draft.diffLines.filter((l) => l.kind === 'added').length} / -
                          {draft.diffLines.filter((l) => l.kind === 'removed').length}
                        </span>
                      </div>
                      <div className="flex-1 max-h-[300px] overflow-y-auto rounded-2xl border border-[var(--border-solid)] bg-[var(--bg-elevated)] p-2.5 font-mono text-[11px] space-y-1">
                        {draft.diffLines.map((line, idx) => (
                          <div
                            key={idx}
                            className={`px-2.5 py-0.5 rounded-lg whitespace-pre-wrap ${
                              line.kind === 'added'
                                ? 'bg-emerald-500/15 text-emerald-500 border-l-2 border-emerald-500'
                                : line.kind === 'removed'
                                ? 'bg-[#D71921]/15 text-[#D71921] border-l-2 border-[#D71921] line-through'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  '}
                            {line.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Bar */}
                  <div className="nothing-card p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-[var(--text-secondary)]">
                      Изменения не применены к базе знаний до вашего подтверждения.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDiscardDraft}
                        className="px-4 py-2 rounded-full text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Отклонить черновик
                      </button>
                      <button
                        onClick={handleCommitDraft}
                        disabled={isCommitting}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {isCommitting
                            ? 'Сохранение...'
                            : draft.mode === 'create'
                            ? 'Подтвердить создание v1'
                            : 'Подтвердить и сохранить версию'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedDoc ? (
                <div className="space-y-5">
                  {/* Document Inspector Header */}
                  <div className="nothing-card p-5 flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                        <span>{selectedDoc.id}</span>
                        <span>·</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold">
                          v{selectedDoc.version || 1}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Shield className="w-3 h-3 text-[#D71921]" />
                          {CLEARANCE_LABELS[selectedDoc.minClearance] ||
                            `LVL-${selectedDoc.minClearance}`}
                        </span>
                        <span>·</span>
                        <span>{selectedDoc.date}</span>
                      </div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">
                        {selectedDoc.title}
                      </h2>
                      <p className="text-xs text-[var(--text-secondary)]">{selectedDoc.summary}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartManualEdit(selectedDoc)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Редактировать (Diff)</span>
                      </button>
                      <button
                        onClick={() => setShowVersions((prev) => !prev)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors ${
                          showVersions
                            ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-transparent font-semibold'
                            : 'border-[var(--border-solid)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>История версий</span>
                      </button>
                    </div>
                  </div>

                  {/* AI Amendment Bar */}
                  <div className="nothing-card p-4 space-y-2.5">
                    <div className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                      ВНЕСТИ ПРАВКИ С ПОМОЩЬЮ AI (С ПРЕДПРОСМОТРОМ DIFF)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        placeholder="Например: добавь пункт о контроле температуры вала перед запуском смены..."
                        className="flex-1 min-w-[240px] bg-[var(--bg-elevated)] border border-[var(--border-solid)] rounded-full px-4 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                      />
                      <button
                        onClick={() => handleGenerateAiDraft('edit')}
                        disabled={isGeneratingDraft || !aiInstruction.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 disabled:opacity-50"
                      >
                        <Cpu className={`w-3.5 h-3.5 ${isGeneratingDraft ? 'animate-spin' : ''}`} />
                        <span>
                          {isGeneratingDraft ? 'Подготовка...' : 'Подготовить правку с AI'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Version History Drawer */}
                  {showVersions && (
                    <div className="nothing-card p-5 space-y-3">
                      <div className="flex items-center justify-between pb-2.5 border-b border-dashed border-[var(--border-dashed)]">
                        <h3 className="font-dot text-xs uppercase tracking-wider text-[var(--text-primary)]">
                          ЖУРНАЛ ВЕРСИЙ ДОКУМЕНТА
                        </h3>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {versions.length} РЕВ.
                        </span>
                      </div>
                      {isLoadingVersions ? (
                        <div className="text-xs text-[var(--text-muted)]">
                          Загрузка истории версий...
                        </div>
                      ) : versions.length === 0 ? (
                        <div className="text-xs text-[var(--text-muted)]">
                          История версий пока пуста.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {versions.map((ver) => (
                            <div
                              key={ver.id}
                              className="p-3 rounded-2xl bg-[var(--bg-elevated)]/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#D71921]">
                                    v{ver.versionNumber}
                                  </span>
                                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                                    {ver.createdAt}
                                  </span>
                                  <span className="text-[11px] text-[var(--text-secondary)]">
                                    · {ver.changedBy}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[var(--text-primary)]">
                                  {ver.changeNote}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleCompareVersion(ver)}
                                  className="px-3 py-1 rounded-full text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-solid)] hover:border-[var(--text-primary)]"
                                >
                                  Diff с текущей
                                </button>
                                {ver.versionNumber !== (selectedDoc.version || 1) && (
                                  <button
                                    onClick={() => handleRollback(ver)}
                                    className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500 hover:bg-amber-500 hover:text-white transition-colors"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Откатить к v{ver.versionNumber}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {compareVersion && (
                        <div className="mt-3 pt-3 border-t border-dashed border-[var(--border-dashed)] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--text-primary)]">
                              Сравнение v{compareVersion.versionNumber} → текущая v
                              {selectedDoc.version || 1}
                            </span>
                            <button
                              onClick={() => setCompareVersion(null)}
                              className="w-6 h-6 rounded-full hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)]"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto rounded-2xl bg-[var(--bg-elevated)] p-3 font-mono text-[11px] space-y-0.5">
                            {compareDiffLines.map((line, idx) => (
                              <div
                                key={idx}
                                className={`px-2 py-0.5 rounded whitespace-pre-wrap ${
                                  line.kind === 'added'
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : line.kind === 'removed'
                                    ? 'bg-[#D71921]/15 text-[#D71921] line-through'
                                    : 'text-[var(--text-secondary)]'
                                }`}
                              >
                                {line.kind === 'added'
                                  ? '+ '
                                  : line.kind === 'removed'
                                  ? '- '
                                  : '  '}
                                {line.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full Document Text */}
                  <div className="nothing-card p-6 space-y-3">
                    <div className="flex items-center gap-2 font-dot text-xs uppercase tracking-wider text-[var(--text-primary)] pb-2.5 border-b border-dashed border-[var(--border-dashed)]">
                      <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      <span>ДЕЙСТВУЮЩИЙ ТЕКСТ РЕГЛАМЕНТА (V{selectedDoc.version || 1})</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-[var(--text-primary)] leading-relaxed">
                      {selectedDoc.content}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)]">
                  Документы для вашей роли не найдены.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
