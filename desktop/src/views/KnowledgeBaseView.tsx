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
} from 'lucide-react';

const CLEARANCE_LABELS: Record<number, string> = {
  1: 'Допуск 1 (Директор)',
  2: 'Допуск 2 (Цех + Директор)',
  3: 'Допуск 3 (Общий)',
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
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  // Stage 3: Document Registry, Diff Preview & Versioning
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
      showToast('Укажите инструкцию', 'Опишите, что нужно создать или изменить в документе', 'warning');
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
        minClearance: draft?.minClearance || (mode === 'edit' ? selectedDoc?.minClearance : roleMinClearance),
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
        'Черновик готов (AI-03)',
        'Проверьте изменения в Diff-превью и подтвердите сохранение в PostgreSQL.',
        'info'
      );
    } catch (err: any) {
      showToast('Ошибка генерации', err?.message || 'Не удалось сформировать черновик через AI', 'error');
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
        'Руководитель отклонил черновик изменений документа до сохранения в БД (AI-03).'
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

    setRagMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const assistantMessage = await queryRAG(queryText);
      setRagMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setRagMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'assistant',
          text: err?.message || 'Ошибка обращения к локальной LLM или базе регламентов.',
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          status: 'needs_clarification',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between gap-4 bg-white dark:bg-[#13151b] shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight truncate">
              База знаний и документы ООО «Фотопринт»
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              RAG-поиск по регламентам, редактирование с Diff-превью и версионирование (AI-03, AI-07)
            </p>
          </div>

          <div className="flex items-center bg-neutral-100 dark:bg-[#1a1d25] p-0.5 rounded-md border border-neutral-200 dark:border-[#262a36] shrink-0">
            <button
              onClick={() => setActiveSubTab('rag')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeSubTab === 'rag'
                  ? 'bg-white dark:bg-[#111318] text-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              RAG-поиск
            </button>
            <button
              onClick={() => setActiveSubTab('docs')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeSubTab === 'docs'
                  ? 'bg-white dark:bg-[#111318] text-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Документы и версии ({documents.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenNewDocEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Новый документ</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'rag' ? (
        <>
          {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full">
        {ragMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-lg p-4 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-neutral-950 text-white dark:bg-[#1e222d] dark:text-white font-medium'
                  : msg.status === 'access_denied'
                  ? 'bg-amber-50 dark:bg-[#1a1813] border border-amber-300 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
                  : 'bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] text-neutral-900 dark:text-neutral-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

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

            <div className="text-[10px] font-mono text-neutral-400 mt-1 px-1">{msg.timestamp}</div>
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="rounded-lg p-3.5 text-xs bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] text-neutral-500 dark:text-neutral-400 font-mono">
              Поиск по регламентам и генерация ответа нейросетью...
            </div>
          </div>
        )}
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
              disabled={isLoading || !inputQuery.trim()}
              className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold rounded-md transition-colors shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Запросить</span>
            </button>
          </form>
        </div>
      </div>
        </>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Searchable RBAC Document List */}
          <div className="w-80 border-r border-neutral-200 dark:border-[#212530] bg-white dark:bg-[#111318] flex flex-col shrink-0">
            <div className="p-3 border-b border-neutral-200 dark:border-[#212530]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Поиск документа или категории..."
                  className="w-full bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262a36] rounded-md pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
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
                    className={`w-full text-left p-2.5 rounded-md border transition-colors space-y-1 ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/40 text-neutral-950 dark:text-white'
                        : 'bg-white dark:bg-[#14161c] border-neutral-200/70 dark:border-[#202430] hover:border-neutral-300 dark:hover:border-[#2c3242] text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#1c202a] text-neutral-600 dark:text-neutral-300">
                        v{doc.version || 1}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">{doc.date}</span>
                    </div>
                    <div className="text-xs font-semibold leading-snug line-clamp-2">{doc.title}</div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                      {doc.category} · Уровень {doc.minClearance}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Draft/Diff Editor OR Document Inspector + Version History */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-5">
              {draft ? (
                <div className="space-y-4">
                  {/* Draft Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-[#212530]">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-sky-600 dark:text-sky-400 font-semibold">
                        <span>
                          {draft.mode === 'create'
                            ? 'Черновик нового документа (v1)'
                            : `Черновик изменений (${draft.documentId})`}
                        </span>
                        {draft.modelUsed && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                            {draft.modelUsed}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-neutral-950 dark:text-white mt-0.5">
                        Предпросмотр изменений (Diff) и подтверждение записи (AI-03)
                      </h2>
                    </div>

                    <button
                      onClick={handleDiscardDraft}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#1a1d25]"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Закрыть черновик</span>
                    </button>
                  </div>

                  {/* Optional AI refinement right inside draft */}
                  <div className="p-3 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      placeholder="Инструкция для AI (напр.: оформи стандарт по новым допускам Delta-E ≤ 1.8)..."
                      className="flex-1 min-w-[240px] bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#262a36] rounded px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={() => handleGenerateAiDraft(draft.mode)}
                      disabled={isGeneratingDraft || !aiInstruction.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 disabled:opacity-50"
                    >
                      <Cpu className={`w-3.5 h-3.5 ${isGeneratingDraft ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingDraft ? 'Генерация...' : 'Сгенерировать через AI'}</span>
                    </button>
                  </div>

                  {/* Metadata Inputs */}
                  <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Название документа
                      </label>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="mt-1 w-full bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#262a36] rounded px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Уровень доступа (RBAC)
                      </label>
                      <select
                        value={draft.minClearance}
                        onChange={(e) => setDraft({ ...draft, minClearance: Number(e.target.value) })}
                        className="mt-1 w-full bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#262a36] rounded px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
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
                      <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Категория
                      </label>
                      <input
                        type="text"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        className="mt-1 w-full bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#262a36] rounded px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Краткая аннотация
                      </label>
                      <input
                        type="text"
                        value={draft.summary}
                        onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                        placeholder="Краткое описание регламента..."
                        className="mt-1 w-full bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#262a36] rounded px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Комментарий к версии (для истории AI-07)
                      </label>
                      <input
                        type="text"
                        value={draft.changeNote}
                        onChange={(e) => setDraft({ ...draft, changeNote: e.target.value })}
                        className="mt-1 w-full bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#262a36] rounded px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Content Editor + Diff Preview Side-by-Side */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          Редактируемый текст
                        </span>
                        <button
                          onClick={() => handleRefreshDraftDiff(draft)}
                          className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
                        >
                          <GitCompare className="w-3 h-3" />
                          <span>Обновить Diff</span>
                        </button>
                      </div>
                      <textarea
                        rows={13}
                        value={draft.content}
                        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                        onBlur={() => handleRefreshDraftDiff(draft)}
                        className="w-full bg-neutral-50 dark:bg-[#0e1015] border border-neutral-200 dark:border-[#262a36] rounded p-3 text-xs font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-sky-500 leading-relaxed resize-y"
                      />
                    </div>

                    <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          Diff-превью (Было → Стало)
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          +{draft.diffLines.filter((l) => l.kind === 'added').length} / -
                          {draft.diffLines.filter((l) => l.kind === 'removed').length}
                        </span>
                      </div>
                      <div className="flex-1 max-h-[300px] overflow-y-auto rounded border border-neutral-200 dark:border-[#222631] bg-neutral-50 dark:bg-[#0e1015] p-2 font-mono text-[11px] space-y-0.5">
                        {draft.diffLines.map((line, idx) => (
                          <div
                            key={idx}
                            className={`px-2 py-0.5 rounded whitespace-pre-wrap ${
                              line.kind === 'added'
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-l-2 border-emerald-500'
                                : line.kind === 'removed'
                                ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-l-2 border-rose-500 line-through'
                                : 'text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  '}
                            {line.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI-03 Explicit Confirmation Bar */}
                  <div className="p-4 rounded-lg bg-amber-500/[0.06] border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-neutral-700 dark:text-neutral-300">
                      Изменения не применены к базе знаний до вашего подтверждения (AI-03).
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDiscardDraft}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-[#1a1d25] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#232733]"
                      >
                        Отклонить черновик
                      </button>
                      <button
                        onClick={handleCommitDraft}
                        disabled={isCommitting}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50"
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
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-[#212530]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                        <span>{selectedDoc.id}</span>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold">
                          Версия v{selectedDoc.version || 1}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {CLEARANCE_LABELS[selectedDoc.minClearance] || `Уровень ${selectedDoc.minClearance}`}
                        </span>
                        <span>·</span>
                        <span>{selectedDoc.date}</span>
                      </div>
                      <h2 className="text-lg font-bold text-neutral-950 dark:text-white mt-1.5">
                        {selectedDoc.title}
                      </h2>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                        {selectedDoc.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartManualEdit(selectedDoc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-neutral-300 dark:border-[#2c3242] bg-white dark:bg-[#15171e] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#1d212b]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Редактировать (Diff)</span>
                      </button>
                      <button
                        onClick={() => setShowVersions((prev) => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          showVersions
                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                            : 'border-neutral-300 dark:border-[#2c3242] bg-white dark:bg-[#15171e] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#1d212b]'
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>История версий</span>
                      </button>
                    </div>
                  </div>

                  {/* AI Amendment Bar */}
                  <div className="p-3.5 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-2">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Внести правки с помощью AI-ассистента (с предпросмотром Diff)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        placeholder="Например: добавь пункт о контроле температуры вала перед запуском смены..."
                        className="flex-1 min-w-[240px] bg-neutral-50 dark:bg-[#101217] border border-neutral-200 dark:border-[#262a36] rounded px-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={() => handleGenerateAiDraft('edit')}
                        disabled={isGeneratingDraft || !aiInstruction.trim()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <Cpu className={`w-3.5 h-3.5 ${isGeneratingDraft ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingDraft ? 'Подготовка...' : 'Подготовить правку с AI'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Version History Panel (AI-07) */}
                  {showVersions && (
                    <div className="p-4 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#1d2028]">
                        <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          Журнал версий документа (PostgreSQL, AI-07)
                        </h3>
                        <span className="text-[11px] font-mono text-neutral-400">
                          {versions.length} рев.
                        </span>
                      </div>
                      {isLoadingVersions ? (
                        <div className="text-xs text-neutral-500">Загрузка истории версий...</div>
                      ) : versions.length === 0 ? (
                        <div className="text-xs text-neutral-500">История версий пока пуста.</div>
                      ) : (
                        <div className="space-y-2">
                          {versions.map((ver) => (
                            <div
                              key={ver.id}
                              className="p-2.5 rounded bg-neutral-50 dark:bg-[#101217] border border-neutral-200/80 dark:border-[#1f232e] flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-sky-700 dark:text-sky-300">
                                    v{ver.versionNumber}
                                  </span>
                                  <span className="text-[11px] text-neutral-500 font-mono">
                                    {ver.createdAt}
                                  </span>
                                  <span className="text-[11px] text-neutral-600 dark:text-neutral-300">
                                    · {ver.changedBy}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-700 dark:text-neutral-300">
                                  {ver.changeNote}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleCompareVersion(ver)}
                                  className="px-2 py-1 rounded text-[11px] border border-neutral-200 dark:border-[#2a2f3d] hover:bg-neutral-100 dark:hover:bg-[#1b1f28]"
                                >
                                  Diff с текущей
                                </button>
                                {ver.versionNumber !== (selectedDoc.version || 1) && (
                                  <button
                                    onClick={() => handleRollback(ver)}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25"
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
                        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-[#212530] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold">
                              Сравнение v{compareVersion.versionNumber} → текущая v{selectedDoc.version || 1}
                            </span>
                            <button
                              onClick={() => setCompareVersion(null)}
                              className="text-neutral-400 hover:text-neutral-700"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto rounded bg-neutral-50 dark:bg-[#0e1015] border border-neutral-200 dark:border-[#222631] p-2 font-mono text-[11px] space-y-0.5">
                            {compareDiffLines.map((line, idx) => (
                              <div
                                key={idx}
                                className={`px-2 py-0.5 rounded whitespace-pre-wrap ${
                                  line.kind === 'added'
                                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                    : line.kind === 'removed'
                                    ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 line-through'
                                    : 'text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                {line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  '}
                                {line.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full Document Text */}
                  <div className="p-5 rounded-lg bg-white dark:bg-[#14161c] border border-neutral-200 dark:border-[#222631] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 pb-2 border-b border-neutral-100 dark:border-[#1d2028]">
                      <FileText className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Действующий текст регламента (v{selectedDoc.version || 1})</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
                      {selectedDoc.content}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">Документы для вашей роли не найдены.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
