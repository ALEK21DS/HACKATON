'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Socket, io } from 'socket.io-client';
import {
  isLoggedIn,
  getMe,
  getBroadcastContacts,
  getBroadcastContactIds,
  getBroadcastCampaignContactMap,
  getBroadcastTemplates,
  generateBroadcastMessage,
  sendBroadcast,
  getCrmBroadcastLists,
  previewBroadcastLists,
  getCampaigns,
  importExcelContacts,
  uploadBroadcastTemplateMedia,
  type BroadcastListPreview,
  type BroadcastContact,
  type BroadcastTemplate,
  type BroadcastMessageType,
  type BroadcastListItem,
  type Campaign,
  type ImportExcelContactsResult,
} from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/format';
import { Spinner } from '@/shared/ui/spinner';

const PAGE_SIZE = 50;

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

// --- Icons ---
function PersonIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function BroadcastIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1.2rem', height: '1.2rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2V15H6L11 19V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SearchIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SparklesIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function renderTemplatePreviewNodes(
  body: string,
  vars: Record<string, string>,
  modes: Record<string, 'fixed' | 'contact_name'>,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{body.slice(lastIndex, match.index)}</span>);
    }
    const varName = match[1];
    const isAutoName = modes[varName] === 'contact_name';
    const value = vars[varName];
    nodes.push(
      <span
        key={key++}
        style={{
          background: isAutoName ? 'rgba(59,130,246,0.15)' : value ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: isAutoName ? '#3B82F6' : value ? '#22C55E' : '#EF4444',
          borderRadius: '4px',
          padding: '0 4px',
          fontWeight: 700,
        }}
      >
        {isAutoName ? 'Nombre del contacto' : value || `{{${varName}}}`}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) {
    nodes.push(<span key={key++}>{body.slice(lastIndex)}</span>);
  }
  return nodes;
}

export default function BroadcastPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [contacts, setContacts] = useState<BroadcastContact[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [matchingIds, setMatchingIds] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messageType, setMessageType] = useState<BroadcastMessageType>('manual');
  const [broadcastLists, setBroadcastLists] = useState<BroadcastListItem[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [listPreview, setListPreview] = useState<BroadcastListPreview | null>(null);
  const [contactSource, setContactSource] = useState<'manual' | 'segments' | 'crm_lists' | 'excel_import'>('manual');
  const [loadingList, setLoadingList] = useState(false);
  const [excelPreviewRows, setExcelPreviewRows] = useState<Array<{ name: string; phone: string }>>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelParsing, setExcelParsing] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState<ImportExcelContactsResult | null>(null);
  const [excelError, setExcelError] = useState('');
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [templateVarModes, setTemplateVarModes] = useState<Record<string, 'fixed' | 'contact_name'>>({});
  const [templateHeaderValue, setTemplateHeaderValue] = useState('');
  const [templateHeaderFileName, setTemplateHeaderFileName] = useState('');
  const [templateHeaderPreviewUrl, setTemplateHeaderPreviewUrl] = useState('');
  const [templateHeaderUploading, setTemplateHeaderUploading] = useState(false);
  const [templateHeaderUploadError, setTemplateHeaderUploadError] = useState('');
  const [templateButtonVars, setTemplateButtonVars] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendResultMessage, setSendResultMessage] = useState('');
  const [broadcastProgress, setBroadcastProgress] = useState<{
    total: number;
    sentCount: number;
    failedCount: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [campaignContactMap, setCampaignContactMap] = useState<Record<string, string[]>>({});
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState('');

  const filteredCampaigns = campaigns.filter(c =>
    !campaignSearch.trim() ||
    c.name.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    (c.description?.toLowerCase().includes(campaignSearch.toLowerCase()) ?? false)
  );

  const loadCrmLists = useCallback(async () => {
    try {
      const bl = await getCrmBroadcastLists();
      setBroadcastLists(bl);
    } catch {
      setBroadcastLists([]);
    }
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    const token = localStorage.getItem('chatcontrol_token');
    const socket = io(WS_BASE, { auth: { token: token || '' } });
    socketRef.current = socket;

    socket.on('broadcast_started', (p: { total: number }) => {
      setBroadcastProgress({ total: p.total, sentCount: 0, failedCount: 0 });
    });
    socket.on('broadcast_message_sent', () => {
      setBroadcastProgress(prev => prev ? { ...prev, sentCount: prev.sentCount + 1 } : prev);
    });
    socket.on('broadcast_message_failed', () => {
      setBroadcastProgress(prev => prev ? { ...prev, failedCount: prev.failedCount + 1 } : prev);
    });

    return () => { socket.disconnect(); };
  }, [mounted]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn()) { router.replace('/login'); return; }
    const initialSource = searchParams?.get('source');
    const initialLists = searchParams?.get('lists');
    if (initialSource === 'crm') {
      setContactSource('crm_lists');
      if (initialLists) {
        setSelectedListIds(new Set(initialLists.split(',').filter(Boolean)));
      }
    }
    (async () => {
      setLoading(true);
      setLoadingCampaigns(true);
      try {
        const [tl, campaignsData] = await Promise.all([getBroadcastTemplates(), getCampaigns()]);
        setTemplates(tl);
        setCampaigns(campaignsData);
        await loadCrmLists();

        if (campaignsData.length > 0) {
          const allIds = campaignsData.map(c => c.id);
          const res = await getBroadcastCampaignContactMap(allIds);
          setCampaignContactMap(res.byCampaign);
        }
      } catch (err) {} finally { setLoading(false); setLoadingCampaigns(false); }
    })();
  }, [mounted, router, searchParams, loadCrmLists]);

  const onlyCanSend = messageType !== 'template';
  const campaignIdsKey = Array.from(selectedCampaignIds).sort().join(',');

  async function loadFirstPage(q: string, campaignIds: string[]) {
    setLoading(true);
    try {
      const [page, ids] = await Promise.all([
        getBroadcastContacts({ q, campaignIds, limit: PAGE_SIZE }),
        getBroadcastContactIds({ q, campaignIds, onlyCanSend }),
      ]);
      setContacts(page.contacts);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      setMatchingIds(ids);
    } catch (err) {} finally { setLoading(false); }
  }

  async function loadMoreContacts() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getBroadcastContacts({ q: debouncedQuery, campaignIds: Array.from(selectedCampaignIds), limit: PAGE_SIZE, cursor: nextCursor });
      setContacts(prev => [...prev, ...page.contacts]);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {} finally { setLoadingMore(false); }
  }

  useEffect(() => {
    if (!mounted || !isLoggedIn() || contactSource !== 'manual') return;
    loadFirstPage(debouncedQuery, Array.from(selectedCampaignIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, debouncedQuery, contactSource, onlyCanSend, campaignIdsKey]);

  function handleContactListScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      loadMoreContacts();
    }
  }

  const refreshListPreview = useCallback(async (listIds: string[]) => {
    if (!listIds.length) {
      setListPreview(null);
      setSelectedIds(new Set());
      return;
    }
    setLoadingList(true);
    try {
      const preview = await previewBroadcastLists(listIds);
      setListPreview(preview);
      setSelectedIds(new Set(preview.conversationIds));
    } catch (err) {
      console.error('Error loading list preview', err);
      setListPreview(null);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (contactSource === 'crm_lists' && selectedListIds.size > 0) {
      refreshListPreview(Array.from(selectedListIds));
    }
  }, [contactSource, selectedListIds, refreshListPreview]);

  // Limpiar selección de contactos inactivos si se cambia a un mensaje que no es plantilla
  useEffect(() => {
    if (messageType !== 'template') {
      setSelectedIds(prev => {
        const next = new Set(prev);
        let changed = false;
        contacts.forEach(c => {
          if (!c.canSend && next.has(c.id)) {
            next.delete(c.id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [messageType, contacts]);

  const toggleContact = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    const isBlocked = messageType !== 'template' && contact && !contact.canSend;
    if (isBlocked) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allMatchingSelected = matchingIds.length > 0 && matchingIds.every(id => selectedIds.has(id));

  const toggleAll = () => {
    const allowedContacts = matchingIds;
    const allAllowedSelected = allMatchingSelected;

    if (allAllowedSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allowedContacts.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allowedContacts.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleGenerateMessage = async () => {
    if (!instruction.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await generateBroadcastMessage(instruction.trim());
      setGeneratedText(res.text ?? '');
    } catch (err) {} finally { setGenerating(false); }
  };

  useEffect(() => {
    return () => {
      if (templateHeaderPreviewUrl) URL.revokeObjectURL(templateHeaderPreviewUrl);
    };
  }, [templateHeaderPreviewUrl]);

  const handleHeaderFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateHeaderPreviewUrl(URL.createObjectURL(file));
    setTemplateHeaderUploading(true);
    setTemplateHeaderUploadError('');
    try {
      const { url } = await uploadBroadcastTemplateMedia(file);
      setTemplateHeaderValue(url);
      setTemplateHeaderFileName(file.name);
    } catch (err) {
      setTemplateHeaderUploadError(err instanceof Error ? err.message : 'Error al subir el archivo.');
    } finally {
      setTemplateHeaderUploading(false);
      e.target.value = '';
    }
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setSendError('');
    setSendResultMessage('');
    try {
      const result = await sendBroadcast({
        conversationIds: Array.from(selectedIds),
        type: messageType,
        text: messageType !== 'template' ? (generatedText || text) : undefined,
        templateId: messageType === 'template' ? templateId : undefined,
        templateVariables: messageType === 'template' ? templateVars : undefined,
        templateAutoNameVariables: messageType === 'template'
          ? Object.entries(templateVarModes).filter(([, mode]) => mode === 'contact_name').map(([v]) => v)
          : undefined,
        templateHeaderValue: messageType === 'template' ? templateHeaderValue : undefined,
        templateButtonVariables: messageType === 'template' ? templateButtonVars : undefined,
      });
      if (result.sent === 0 && result.failed > 0) {
        setSendError(`No se envió ningún mensaje (${result.failed} fallidos). ${result.errors[0]?.error ?? ''}`);
      } else {
        if (result.failed > 0) {
          setSendError(`${result.sent} enviados, ${result.failed} fallidos. ${result.errors[0]?.error ?? ''}`);
        } else {
          setSendResultMessage(`${result.sent} mensaje${result.sent === 1 ? '' : 's'} enviado${result.sent === 1 ? '' : 's'} correctamente.`);
        }
        setSelectedIds(new Set());
        setText(''); setInstruction(''); setGeneratedText('');
        setTemplateVarModes({});
        setTemplateHeaderValue(''); setTemplateHeaderFileName(''); setTemplateHeaderPreviewUrl(''); setTemplateButtonVars({});
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Error al enviar el masivo.');
    } finally {
      setSending(false);
      setTimeout(() => setBroadcastProgress(null), 4000);
    }
  };

  const toggleListSelection = (listId: string) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  };

  const toggleCampaign = (campaignId: string) => {
    const nextCampaigns = new Set(selectedCampaignIds);
    const nextContacts = new Set(selectedIds);

    if (nextCampaigns.has(campaignId)) {
      nextCampaigns.delete(campaignId);
      const toRemove = campaignContactMap[campaignId] || [];
      for (const cid of toRemove) nextContacts.delete(cid);
    } else {
      nextCampaigns.add(campaignId);
      const ids = campaignContactMap[campaignId] || [];
      for (const cid of ids) nextContacts.add(cid);
    }

    setSelectedCampaignIds(nextCampaigns);
    setSelectedIds(nextContacts);
  };

  const handleSourceChange = (source: 'manual' | 'segments' | 'crm_lists' | 'excel_import') => {
    setContactSource(source);
    setSelectedListIds(new Set());
    setListPreview(null);
    setExcelPreviewRows([]);
    setExcelFileName('');
    setExcelImportResult(null);
    setExcelError('');
    if (source === 'segments') {
      setSelectedIds(new Set());
      setLoadingList(true);
      getBroadcastContactIds({}).then(ids => setSelectedIds(new Set(ids))).catch(() => {}).finally(() => setLoadingList(false));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleDownloadExcelTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'numero'],
      ['Juan Pérez', '3001234567'],
      ['María Gómez', '3109876543'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    XLSX.writeFile(wb, 'plantilla_contactos_masivos.xlsx');
  };

  const handleExcelFileSelect = async (file: File) => {
    setExcelError('');
    setExcelImportResult(null);
    setSelectedIds(new Set());
    setExcelFileName(file.name);
    setExcelParsing(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      let dataRows = rawRows;
      const firstRow = rawRows[0]?.map(v => String(v ?? '').trim().toLowerCase()) || [];
      if (firstRow[0]?.includes('nombre') || firstRow[1]?.includes('numero') || firstRow[1]?.includes('número') || firstRow[1]?.includes('telefono')) {
        dataRows = rawRows.slice(1);
      }

      const rows = dataRows
        .map(r => ({ name: String(r[0] ?? '').trim(), phone: String(r[1] ?? '').trim() }))
        .filter(r => r.phone);

      if (!rows.length) {
        setExcelError('No se encontraron filas con número de teléfono en el archivo.');
        setExcelPreviewRows([]);
      } else {
        setExcelPreviewRows(rows);
      }
    } catch (err) {
      setExcelError('No se pudo leer el archivo. Verifica que sea un .xlsx o .xls válido.');
      setExcelPreviewRows([]);
    } finally {
      setExcelParsing(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelPreviewRows.length || excelImporting) return;
    setExcelImporting(true);
    setExcelError('');
    try {
      const result = await importExcelContacts(excelPreviewRows);
      setExcelImportResult(result);
      setSelectedIds(new Set(result.conversationIds));
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : 'Error al importar el archivo.');
    } finally {
      setExcelImporting(false);
    }
  };

  const forceMetaTemplate = contactSource === 'excel_import' && (excelImportResult?.outOfWindowCount ?? 0) > 0;

  useEffect(() => {
    if (forceMetaTemplate && messageType !== 'template') {
      setMessageType('template');
    }
    if (forceMetaTemplate && templateId && !templateId.startsWith('meta_')) {
      setTemplateId('');
    }
  }, [forceMetaTemplate, messageType, templateId]);

  const selectedTemplate = templates.find(t => t.id === templateId);
  const templateOptions = forceMetaTemplate ? templates.filter(t => t.id.startsWith('meta_')) : templates;

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', background: '#040404', color: '#F2F2F2', overflow: 'hidden' }}>
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Card flotante de progreso de envío masivo */}
      {broadcastProgress && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          background: '#0d0d0d',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          minWidth: '220px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Enviando Masivo
            </span>
            {sending && <Spinner size={14} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white' }}>
              {String(broadcastProgress.sentCount + broadcastProgress.failedCount).padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 700 }}>/ {broadcastProgress.total}</span>
          </div>
          <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              width: `${broadcastProgress.total > 0 ? ((broadcastProgress.sentCount + broadcastProgress.failedCount) / broadcastProgress.total) * 100 : 0}%`,
              height: '100%',
              background: broadcastProgress.failedCount > 0 ? 'linear-gradient(90deg, #EF4444, #F59E0B)' : '#EF4444',
              transition: 'width 0.2s ease',
            }} />
          </div>
          {broadcastProgress.failedCount > 0 && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.68rem', color: '#F59E0B', fontWeight: 700 }}>
              {broadcastProgress.failedCount} fallido{broadcastProgress.failedCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}

      {/* Toast de resultado del envío */}
      {(sendError || sendResultMessage) && (
        <div style={{
          position: 'fixed',
          top: broadcastProgress ? '9.5rem' : '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          maxWidth: '320px',
          background: sendError ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
          border: `1px solid ${sendError ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
          borderRadius: '14px',
          padding: '0.9rem 1.1rem',
          color: sendError ? '#EF4444' : '#4ADE80',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <span style={{ flex: 1 }}>{sendError || sendResultMessage}</span>
          <button
            onClick={() => { setSendError(''); setSendResultMessage(''); }}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.7, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Sidebar: Audiencia ── */}
      <aside className={`aside-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Masivos</h2>
            <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#EF4444' }}>
              <BroadcastIcon />
            </div>
          </div>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <SearchIcon style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
            <input 
              type="text" 
              placeholder="Buscar contactos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem 0.75rem 2.8rem', color: 'white', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {([
              ['manual', 'Contactos Manuales'],
              ['segments', 'Segmentos'],
              ['crm_lists', 'Listas CRM'],
              ['excel_import', 'Importar Excel'],
            ] as const).map(([source, label]) => (
              <button
                key={source}
                type="button"
                onClick={() => handleSourceChange(source)}
                style={{
                  flex: 1,
                  minWidth: 90,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: contactSource === source ? '#EF4444' : 'rgba(255,255,255,0.03)',
                  color: contactSource === source ? 'white' : '#8C8C8C',
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {contactSource === 'crm_lists' ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                Selecciona una o varias listas
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {broadcastLists.map((l) => (
                  <label
                    key={l.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.5rem 0.75rem',
                      borderRadius: 10,
                      background: selectedListIds.has(l.id) ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedListIds.has(l.id) ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedListIds.has(l.id)}
                      onChange={() => toggleListSelection(l.id)}
                    />
                    <span style={{ flex: 1 }}>{l.name}</span>
                    <span style={{ color: '#666', fontSize: '0.7rem' }}>({l.contactCount})</span>
                  </label>
                ))}
              </div>
              {listPreview && (
                <div style={{
                  marginTop: 10,
                  padding: '0.75rem',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.7rem',
                  color: '#8C8C8C',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}>
                  <span>Total: <strong style={{ color: '#F2F2F2' }}>{listPreview.total}</strong></span>
                  <span>Únicos: <strong style={{ color: '#22c55e' }}>{listPreview.unique}</strong></span>
                  <span>Duplicados: <strong style={{ color: '#f59e0b' }}>{listPreview.duplicates}</strong></span>
                  <span>Inválidos: <strong style={{ color: '#ef4444' }}>{listPreview.invalid}</strong></span>
                  <span style={{ gridColumn: '1 / -1' }}>Bloqueados: <strong style={{ color: '#ef4444' }}>{listPreview.blocked}</strong></span>
                </div>
              )}
            </div>
          ) : contactSource === 'excel_import' ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                Excel con columnas &quot;nombre&quot; y &quot;numero&quot;
              </div>
              <button
                type="button"
                onClick={handleDownloadExcelTemplate}
                style={{ width: '100%', padding: '0.6rem', marginBottom: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#8C8C8C', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar plantilla
              </button>
              <input
                ref={excelFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelFileSelect(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => excelFileInputRef.current?.click()}
                disabled={excelParsing}
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.3)', borderRadius: 10, color: '#EF4444', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: excelParsing ? 'default' : 'pointer' }}
              >
                {excelParsing ? <Spinner size={14} /> : (excelFileName || 'Seleccionar archivo .xlsx')}
              </button>

              {excelError && (
                <p style={{ marginTop: 8, fontSize: '0.7rem', color: '#EF4444', fontWeight: 600 }}>{excelError}</p>
              )}

              {excelPreviewRows.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: '0.7rem', color: '#8C8C8C', marginBottom: 6 }}>
                    {excelImportResult ? `${excelPreviewRows.length} contactos importados` : `${excelPreviewRows.length} filas detectadas`}
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: excelImportResult ? 0 : 10 }}>
                    {excelPreviewRows.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: '#AAA', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '(sin nombre)'}</span>
                        <span style={{ color: '#666' }}>{r.phone}</span>
                      </div>
                    ))}
                  </div>
                  {!excelImportResult && (
                    <button
                      type="button"
                      onClick={handleConfirmExcelImport}
                      disabled={excelImporting}
                      style={{ width: '100%', padding: '0.65rem', background: '#EF4444', border: 'none', borderRadius: 10, color: 'white', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: excelImporting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      {excelImporting && <Spinner size={14} />}
                      {excelImporting ? 'Importando...' : 'Confirmar importación'}
                    </button>
                  )}
                </div>
              )}

              {excelImportResult && (
                <div style={{
                  marginTop: 10,
                  padding: '0.75rem',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.7rem',
                  color: '#8C8C8C',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}>
                  <span>Creados: <strong style={{ color: '#22c55e' }}>{excelImportResult.created}</strong></span>
                  <span>Actualizados: <strong style={{ color: '#3b82f6' }}>{excelImportResult.updated}</strong></span>
                  <span>Rechazados: <strong style={{ color: '#ef4444' }}>{excelImportResult.rejected}</strong></span>
                  <span>Fuera de ventana: <strong style={{ color: '#f59e0b' }}>{excelImportResult.outOfWindowCount}</strong></span>
                  <span style={{ gridColumn: '1 / -1' }}>Listos: <strong style={{ color: '#F2F2F2' }}>{selectedIds.size}</strong></span>
                  {excelImportResult.outOfWindowCount > 0 && (
                    <span style={{ gridColumn: '1 / -1', color: '#F59E0B', fontWeight: 700 }}>
                      {excelImportResult.outOfWindowCount} contacto{excelImportResult.outOfWindowCount === 1 ? '' : 's'} ({excelImportResult.newContactIds.length} nuevo{excelImportResult.newContactIds.length === 1 ? '' : 's'}) {excelImportResult.outOfWindowCount === 1 ? 'está' : 'están'} fuera de la ventana de 24h: se exige plantilla aprobada de Meta para el envío.
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : contactSource === 'manual' ? (
            <>
              <button
                onClick={toggleAll}
                style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: '#8C8C8C', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '0.75rem' }}
              >
                {allMatchingSelected ? `Desmarcar todos (${total})` : `Seleccionar todos (${total})`}
              </button>

              {!loadingCampaigns && campaigns.length > 0 && (
                <div style={{ padding: '0.65rem 0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Filtrar por campaña
                  </p>

                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <SearchIcon style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#444', width: '0.75rem', height: '0.75rem' }} />
                    <input
                      type="text"
                      placeholder="Buscar campaña..."
                      value={campaignSearch}
                      onChange={(e) => setCampaignSearch(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.4rem 0.5rem 0.4rem 1.6rem', color: 'white', outline: 'none', fontSize: '0.72rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {filteredCampaigns.length === 0 ? (
                      <p style={{ fontSize: '0.7rem', color: '#555', padding: '0.5rem 0', textAlign: 'center' }}>
                        {campaignSearch ? 'Sin resultados' : 'Sin campañas'}
                      </p>
                    ) : filteredCampaigns.map(c => {
                      const isCampaignSelected = selectedCampaignIds.has(c.id);
                      const contactCount = campaignContactMap[c.id]?.length || 0;
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleCampaign(c.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.25rem', borderRadius: '6px', cursor: 'pointer', userSelect: 'none', opacity: c.isActive ? 1 : 0.55 }}
                        >
                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, border: `2px solid ${isCampaignSelected ? '#EF4444' : 'rgba(255,255,255,0.15)'}`, background: isCampaignSelected ? '#EF4444' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                            {isCampaignSelected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isCampaignSelected ? '#FFF' : '#AAA', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: '#555' }}>{contactCount}</span>
                          {c.isActive && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#4ADE80', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Activa</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '0.75rem', marginBottom: '0.75rem', borderRadius: 10, background: 'rgba(239,68,68,0.06)', color: '#EF4444', fontSize: '0.75rem', fontWeight: 700 }}>
              {selectedIds.size} contactos del segmento (todos los contactos de la organización)
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar" onScroll={handleContactListScroll}>
          {loading || loadingList ? (
            <div style={{ padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div className="pulse-heartbeat">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#EF4444">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#222', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                {contactSource === 'crm_lists' ? 'Cargando Listas CRM' : contactSource === 'segments' ? 'Cargando Segmento' : 'Cargando Audiencia'}
              </span>
            </div>
          ) : contactSource === 'crm_lists' && selectedListIds.size > 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#22c55e', fontSize: '0.9rem', fontWeight: 700 }}>
              {selectedIds.size} contactos listos desde {selectedListIds.size} lista(s) CRM
            </div>
          ) : contactSource === 'segments' ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#22c55e', fontSize: '0.9rem', fontWeight: 700 }}>
              Segmento completo: {selectedIds.size} contactos
            </div>
          ) : contactSource === 'excel_import' ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: excelImportResult ? '#22c55e' : '#555', fontSize: '0.9rem', fontWeight: 700 }}>
              {excelImportResult ? `${selectedIds.size} contactos listos desde el Excel importado` : 'Selecciona un archivo Excel para comenzar'}
            </div>
          ) : (
            <>
              {contacts.map(c => {
            const isBlocked = messageType !== 'template' && !c.canSend;
            const isSelected = selectedIds.has(c.id);

            return (
              <div
                key={c.id}
                onClick={() => !isBlocked && toggleContact(c.id)}
                style={{ 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '1rem', 
                  borderRadius: '16px', 
                  background: isSelected ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  cursor: isBlocked ? 'not-allowed' : 'pointer',
                  opacity: isBlocked ? 0.35 : 1,
                  transition: 'all 0.2s ease',
                  marginBottom: '0.25rem',
                  border: isSelected ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent'
                }}
              >
                <div style={{ 
                  width: '18px', height: '18px', borderRadius: '5px', 
                  border: '2px solid',
                  borderColor: isBlocked ? '#222' : isSelected ? '#EF4444' : '#333',
                  background: isBlocked ? 'transparent' : isSelected ? '#EF4444' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                }}>
                  {!isBlocked && isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  <PersonIcon style={{ width: '1rem', height: '1rem' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F2F2F2', display: 'block' }}>{c.name || formatPhoneDisplay(c.phone)}</span>
                  <span style={{ fontSize: '0.7rem', color: c.canSend ? '#666' : '#EF4444', fontWeight: 600 }}>
                    {c.canSend 
                      ? `Ventana: ${Math.floor(c.windowSecondsRemaining / 3600)}h restantes` 
                      : isBlocked 
                        ? 'Fuera de ventana (Solo Plantilla)' 
                        : 'Fuera de ventana'
                    }
                  </span>
                </div>
              </div>
                );
              })}
              {loadingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                  <Spinner size={18} />
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Main: Consola de Lanzamiento ── */}
      <main className="page-main custom-scrollbar">
        
        <div style={{ width: '100%', margin: '0' }}>
          <header style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="mob-sidebar-btn"
                aria-label="Abrir lista de contactos"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>Lanzamiento Masivo</h1>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <a href="/broadcast" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', textDecoration: 'none' }}>Campañas</a>
              <a href="/templates" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', textDecoration: 'none' }}>Templates</a>
              <a href="/broadcast/crm-lists" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', textDecoration: 'none' }}>Listas CRM</a>
              <a href="/broadcast/audit" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', textDecoration: 'none' }}>Auditoría</a>
            </div>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>Configura y dispara campañas masivas de alta tasa de apertura.</p>
          </header>

          {/* Selector de Tipo de Mensaje */}
          <div style={{ background: '#080808', borderRadius: '20px', padding: '0.5rem', display: 'flex', gap: '0.5rem', marginBottom: forceMetaTemplate ? '0.75rem' : '2.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            {(['manual', 'template', 'ia'] as BroadcastMessageType[])
              .filter((type) => !forceMetaTemplate || type === 'template')
              .map((type) => {
              return (
                <button
                  key={type}
                  onClick={() => setMessageType(type)}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: '16px', border: 'none',
                    background: messageType === type ? '#EF4444' : 'transparent',
                    color: messageType === type ? 'white' : '#666',
                    fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                    cursor: 'pointer', transition: 'all 0.3s ease',
                    boxShadow: messageType === type ? '0 10px 20px rgba(239, 68, 68, 0.2)' : 'none'
                  }}
                >
                  {type === 'manual' ? 'Texto Libre' : type === 'template' ? 'Plantilla Oficial' : 'Asistente IA'}
                </button>
              );
            })}
          </div>

          {forceMetaTemplate && (
            <p style={{ marginBottom: '1.75rem', fontSize: '0.75rem', color: '#F59E0B', fontWeight: 700 }}>
              El Excel importado incluye contactos nuevos y/o fuera de la ventana de 24h: WhatsApp exige una plantilla aprobada de Meta para escribirles, por eso solo esa opción está disponible para este envío.
            </p>
          )}

          {/* Área de Composición */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2rem' }}>
            {messageType === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contenido del Mensaje</label>
                <textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escribe el mensaje que recibirán tus contactos..."
                  style={{ width: '100%', minHeight: '200px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem', color: 'white', outline: 'none', fontSize: '1rem', resize: 'vertical', lineHeight: '1.6' }}
                />
              </div>
            )}

            {messageType === 'template' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Selecciona una Plantilla</label>
                  <select 
                    value={templateId}
                    onChange={(e) => {
                      setTemplateId(e.target.value);
                      setTemplateVars({});
                      setTemplateVarModes({});
                      setTemplateHeaderValue('');
                      setTemplateHeaderFileName('');
                      setTemplateHeaderPreviewUrl('');
                      setTemplateHeaderUploadError('');
                      setTemplateButtonVars({});
                    }}
                    style={{ 
                      width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.25rem', color: 'white', outline: 'none', fontSize: '1rem', appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23EF4444' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center', backgroundSize: '1.2rem'
                    }}
                  >
                    <option value="" style={{ background: '#0d0d0d' }}>Seleccionar...</option>
                    {templateOptions.map(t => <option key={t.id} value={t.id} style={{ background: '#0d0d0d' }}>{t.name}</option>)}
                  </select>
                  {forceMetaTemplate && templateOptions.length === 0 && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 }}>
                      No hay plantillas aprobadas de Meta disponibles. Crea/aprueba una plantilla oficial antes de enviar a estos contactos nuevos.
                    </p>
                  )}
                </div>

                {selectedTemplate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Vista Previa del Mensaje</label>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.25rem', color: '#ddd', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {renderTemplatePreviewNodes(selectedTemplate.body, templateVars, templateVarModes)}
                    </div>
                  </div>
                )}

                {selectedTemplate && selectedTemplate.variables.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Variables de la Plantilla</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {selectedTemplate.variables.map(v => {
                        const mode = templateVarModes[v] || 'fixed';
                        return (
                          <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{v}</span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => setTemplateVarModes(prev => ({ ...prev, [v]: 'fixed' }))}
                                style={{
                                  flex: 1, padding: '0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                  border: mode === 'fixed' ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.08)',
                                  background: mode === 'fixed' ? 'rgba(239,68,68,0.12)' : 'transparent',
                                  color: mode === 'fixed' ? '#EF4444' : '#888',
                                }}
                              >
                                Valor fijo
                              </button>
                              <button
                                type="button"
                                onClick={() => setTemplateVarModes(prev => ({ ...prev, [v]: 'contact_name' }))}
                                style={{
                                  flex: 1, padding: '0.5rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                  border: mode === 'contact_name' ? '1px solid #3B82F6' : '1px solid rgba(255,255,255,0.08)',
                                  background: mode === 'contact_name' ? 'rgba(59,130,246,0.12)' : 'transparent',
                                  color: mode === 'contact_name' ? '#3B82F6' : '#888',
                                }}
                              >
                                Nombre del contacto
                              </button>
                            </div>
                            {mode === 'fixed' ? (
                              <input
                                type="text"
                                placeholder={v.toUpperCase()}
                                value={templateVars[v] || ''}
                                onChange={(e) => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: 'white', outline: 'none' }}
                              />
                            ) : (
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#3B82F6' }}>
                                Se reemplazará automáticamente por el nombre registrado de cada contacto.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedTemplate?.header && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {selectedTemplate.header.format === 'TEXT'
                        ? 'Variable del Encabezado'
                        : `Archivo de ${selectedTemplate.header.format.toLowerCase()} para el Encabezado`}
                    </label>
                    {selectedTemplate.header.format === 'TEXT' ? (
                      <input
                        type="text"
                        placeholder="VALOR"
                        value={templateHeaderValue}
                        onChange={(e) => setTemplateHeaderValue(e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: 'white', outline: 'none' }}
                      />
                    ) : (
                      <>
                        <input
                          type="file"
                          accept={
                            selectedTemplate.header.format === 'IMAGE' ? 'image/*'
                              : selectedTemplate.header.format === 'VIDEO' ? 'video/*'
                              : undefined
                          }
                          onChange={handleHeaderFileChange}
                          disabled={templateHeaderUploading}
                          style={{ color: 'white', fontSize: '0.85rem' }}
                        />
                        {templateHeaderPreviewUrl && selectedTemplate.header.format === 'IMAGE' && (
                          <Image
                            src={templateHeaderPreviewUrl}
                            alt="Vista previa del encabezado"
                            width={220}
                            height={220}
                            unoptimized
                            style={{ maxWidth: '220px', maxHeight: '220px', width: 'auto', height: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', objectFit: 'cover' }}
                          />
                        )}
                        {templateHeaderPreviewUrl && selectedTemplate.header.format === 'VIDEO' && (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video
                            src={templateHeaderPreviewUrl}
                            controls
                            style={{ maxWidth: '260px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        )}
                        {templateHeaderUploading && <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>Subiendo archivo...</p>}
                        {!templateHeaderUploading && templateHeaderFileName && (
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#22C55E' }}>Archivo listo: {templateHeaderFileName}</p>
                        )}
                        {templateHeaderUploadError && (
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#EF4444' }}>{templateHeaderUploadError}</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {selectedTemplate?.buttons && selectedTemplate.buttons.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Variables de Botones</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {selectedTemplate.buttons.map(btn => (
                        <input
                          key={btn.index}
                          type="text"
                          placeholder={btn.text.toUpperCase()}
                          value={templateButtonVars[String(btn.index)] || ''}
                          onChange={(e) => setTemplateButtonVars(prev => ({ ...prev, [String(btn.index)]: e.target.value }))}
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', color: 'white', outline: 'none' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {messageType === 'ia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Instrucción para Gemini</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input 
                      type="text" 
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Ej: Redacta una invitación formal para un evento de networking..."
                      style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1rem', color: 'white', outline: 'none' }}
                    />
                    <button 
                      onClick={handleGenerateMessage}
                      disabled={generating}
                      style={{ padding: '0 1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '14px', color: '#EF4444', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {generating ? <Spinner size={16} /> : <SparklesIcon />}
                      {generating ? '...' : 'GENERAR'}
                    </button>
                  </div>
                </div>
                {(generatedText || text) && (
                  <textarea 
                    value={generatedText || text}
                    onChange={(e) => { setGeneratedText(''); setText(e.target.value); }}
                    style={{ width: '100%', minHeight: '150px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.25rem', color: '#8C8C8C', outline: 'none', fontSize: '0.95rem' }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Confirmación y Envío */}
          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2.5rem', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '24px' }}>
            <div>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', display: 'block' }}>{selectedIds.size}</span>
              <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contactos Seleccionados</span>
            </div>
            <button
              onClick={handleSend}
              disabled={
                sending ||
                selectedIds.size === 0 ||
                templateHeaderUploading ||
                (messageType === 'template' && !!selectedTemplate?.header && selectedTemplate.header.format !== 'TEXT' && !templateHeaderValue)
              }
              style={{
                padding: '1.25rem 3rem', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.3s ease',
                boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)', opacity: (
                  sending ||
                  selectedIds.size === 0 ||
                  templateHeaderUploading ||
                  (messageType === 'template' && !!selectedTemplate?.header && selectedTemplate.header.format !== 'TEXT' && !templateHeaderValue)
                ) ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              {sending ? <Spinner size={16} /> : null}
              {sending ? 'Lanzando...' : 'Lanzar Masivos'}
            </button>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #EF4444; }

        .pulse-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
          filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.4));
        }

        @keyframes heartbeat {
          0% { transform: scale(0.9); opacity: 0.4; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.4; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mob-sidebar-btn {
          display: none;
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          color: #8C8C8C;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mob-sidebar-btn:hover { background: rgba(255,255,255,0.08); color: #F2F2F2; }
        @media (max-width: 768px) { .mob-sidebar-btn { display: flex; } }
      `}</style>
    </div>
  );
}
