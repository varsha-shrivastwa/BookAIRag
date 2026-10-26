'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  FileText, X, Upload, Loader2, CheckCircle, AlertCircle,
  Plus, MessageSquare, Trash2, Bot,
} from 'lucide-react';
import { useConversations } from '@/context/ConversationsContext';
import { useDocuments } from '@/context/DocumentsContext';
import { uploadDocument, streamUploadProgress } from '@/services/documentsApi';

/* ── Date bucket helpers (same logic as original ConversationSidebar) ── */
function getBucket(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  if (diffDays < 30) return 'This month';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupConversations(conversations) {
  const buckets = {};
  const order = [];
  for (const c of conversations) {
    const label = getBucket(c.updatedAt || c.createdAt);
    if (!buckets[label]) { buckets[label] = []; order.push(label); }
    buckets[label].push(c);
  }
  return { buckets, order };
}

/* ── Tiny local ID generator ─────────────────────────────────────── */
function genLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ── Spinner component ───────────────────────────────────────────── */
function Spinner({ size = 14 }) {
  return (
    <Loader2
      size={size}
      style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
    />
  );
}

/* ── UnifiedSidebar ──────────────────────────────────────────────── */
export function UnifiedSidebar({ onMobileClose, onNewChat }) {
  /* Conversations context */
  const {
    conversations, currentId,
    switchConversation, deleteConversation, createConversation,
  } = useConversations();

  /* Documents context */
  const { documents, addDocument, updateDocument, removeDocument, toggleSelection, selectedIds } = useDocuments();

  /* Local upload queue — lives from file-pick through full processing */
  // [{localId, name, status:'uploading'|'processing'|'error', percent:0-100, documentId?, error?}]
  const [activeUploads, setActiveUploads] = useState([]);

  /* Chat-list hover/confirm state */
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [confirmChatId, setConfirmChatId] = useState(null);

  /* Doc-list hover/confirm state */
  const [hoveredDocId, setHoveredDocId] = useState(null);
  const [confirmDocId, setConfirmDocId] = useState(null);

  const fileRef = useRef(null);

  /* ── New chat ─────────────────────────────────────────────────── */
  const handleNewChat = useCallback(() => {
    const id = createConversation();
    onMobileClose?.();
    onNewChat?.(id);
  }, [createConversation, onMobileClose, onNewChat]);

  /* ── Select conversation ──────────────────────────────────────── */
  const handleSelectChat = useCallback((id) => {
    switchConversation(id);
    onMobileClose?.();
  }, [switchConversation, onMobileClose]);

  /* ── Delete conversation ──────────────────────────────────────── */
  const handleDeleteChat = useCallback((e, id) => {
    e.stopPropagation();
    if (confirmChatId === id) {
      deleteConversation(id);
      setConfirmChatId(null);
    } else {
      setConfirmChatId(id);
      setTimeout(() => setConfirmChatId((c) => (c === id ? null : c)), 3000);
    }
  }, [confirmChatId, deleteConversation]);

  /* ── Delete document ──────────────────────────────────────────── */
  const handleDeleteDoc = useCallback(async (e, id) => {
    e.stopPropagation();
    if (confirmDocId === id) {
      setConfirmDocId(null);
      try { await removeDocument(id); } catch (err) { console.error('Delete doc failed:', err); }
    } else {
      setConfirmDocId(id);
      setTimeout(() => setConfirmDocId((c) => (c === id ? null : c)), 3000);
    }
  }, [confirmDocId, removeDocument]);

  /* ── File upload ──────────────────────────────────────────────── */
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;

    const localId = genLocalId();

    const patchUpload = (patch) =>
      setActiveUploads((prev) => prev.map((u) => u.localId === localId ? { ...u, ...patch } : u));

    // 1. Add to local upload queue at 0%
    setActiveUploads((prev) => [...prev, { localId, name: file.name, status: 'uploading', percent: 0, label: 'Uploading…' }]);

    try {
      // 2. POST file — XHR maps to 0–20% (localhost transfer is near-instant)
      const result = await uploadDocument(file, (pct) => {
        patchUpload({ percent: Math.round(pct * 0.2) });
      });
      const { documentId, name, sizeBytes } = result;

      // Upload done → 20%, switch to processing
      patchUpload({ percent: 20, status: 'processing', label: 'Extracting…', documentId });

      // 3. Add to documents context (hidden from list while in activeUploads)
      addDocument({ id: documentId, name, sizeBytes, status: 'extracting' });

      // 4. Drive remaining 80% from SSE processing stages
      streamUploadProgress(
        documentId,
        /* onStage */ (stage, _msg, progressData) => {
          updateDocument(documentId, { status: stage });
          if (stage === 'extracting') {
            // progressData.percent = 0-100 covering classify + render + extract phases
            const base = 20;
            const bonus = progressData ? Math.round(progressData.percent * 0.35) : 0;
            const label = progressData?.percent != null
              ? `Extracting… ${progressData.percent}%`
              : 'Extracting text…';
            patchUpload({ percent: base + bonus, label });
          } else if (stage === 'analyzing') {
            patchUpload({ percent: 58, label: 'Analyzing structure…' });
          } else if (stage === 'indexing') {
            // progressData = { percent: 0-100, indexedChunks, totalChunks }
            const base = 60;
            const bonus = progressData ? Math.round(progressData.percent * 0.35) : 0;
            const label = progressData?.totalChunks
              ? `Indexing ${progressData.indexedChunks ?? 0} / ${progressData.totalChunks} chunks…`
              : 'Indexing chunks…';
            patchUpload({ percent: base + bonus, label });
          } else {
            patchUpload({ percent: 58, label: stage });
          }
        },
        /* onDone  */ (event) => {
          updateDocument(documentId, { status: 'ready', chunkCount: event.chunkCount });
          patchUpload({ percent: 100, label: 'Ready!' });
          // Remove from active uploads after briefly showing 100%
          setTimeout(() => {
            setActiveUploads((prev) => prev.filter((u) => u.localId !== localId));
          }, 900);
        },
        /* onError */ (errMsg) => {
          updateDocument(documentId, { status: 'error', error: errMsg });
          patchUpload({ status: 'error', error: errMsg });
        },
      );
    } catch (err) {
      patchUpload({ status: 'error', error: err.message });
    }
  }, [addDocument, updateDocument]);

  /* ── Helpers ──────────────────────────────────────────────────── */
  const getDocStatusColor = (status) => {
    if (status === 'ready') return '#22c55e';
    if (status === 'error' || status === 'failed') return '#ef4444';
    return '#7c3aed';
  };

  const getDocBadgeBg = (status) => {
    if (status === 'ready') return 'rgba(34,197,94,0.15)';
    if (status === 'error' || status === 'failed') return 'rgba(239,68,68,0.15)';
    return 'rgba(124,58,237,0.15)';
  };

  const formatDocStatus = (status) => {
    if (!status) return 'processing';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const truncateName = (name, maxLen = 22) =>
    name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;

  // IDs of documents currently being processed in the active upload queue
  // — hide them from the documents list to avoid showing the file twice
  const activeDocIds = new Set(activeUploads.filter((u) => u.documentId).map((u) => u.documentId));

  const { buckets, order } = groupConversations(conversations);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'linear-gradient(180deg, #0a0616 0%, #080512 100%)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      overflow: 'hidden',
    }}>

      {/* ══ Header ═══════════════════════════════════════════════ */}
      <div style={{ padding: '18px 14px 12px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '0',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '11px', flexShrink: 0,
              background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(124,58,237,0.45)',
            }}>
              <FileText size={16} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{
                fontSize: '15px', fontWeight: 800, lineHeight: 1,
                background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 50%, #ec4899 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                DocAI
              </div>
              <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: 500, marginTop: '2px' }}>
                AI Assistant
              </div>
            </div>
          </div>

          {/* Mobile close */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              style={{
                width: '28px', height: '28px', borderRadius: '8px', border: 'none',
                background: 'rgba(255,255,255,0.05)', color: '#4b5563',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ══ Scrollable content ═══════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {/* ── Documents section ─────────────────────────────── */}
        <div style={{ padding: '0 8px 6px' }}>

          {/* Section label */}
          <div style={{
            padding: '8px 8px 6px',
            fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#2d2d3a',
          }}>
            Documents
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px', borderRadius: '10px',
              border: '1.5px dashed rgba(124,58,237,0.35)',
              background: 'rgba(124,58,237,0.04)',
              color: '#7c5cad', cursor: 'pointer',
              fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.2s', marginBottom: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)';
              e.currentTarget.style.background = 'rgba(124,58,237,0.1)';
              e.currentTarget.style.color = '#c4b5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)';
              e.currentTarget.style.background = 'rgba(124,58,237,0.04)';
              e.currentTarget.style.color = '#7c5cad';
            }}
          >
            <Upload size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
            Upload Document
          </button>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Active uploads — visible from file-pick through full processing */}
          {activeUploads.map((u) => {
            const isErr = u.status === 'error';
            const pct = u.percent ?? 0;
            return (
              <div
                key={u.localId}
                style={{
                  padding: '8px 10px', marginBottom: '4px', borderRadius: '10px',
                  background: isErr ? 'rgba(239,68,68,0.07)' : 'rgba(124,58,237,0.07)',
                  border: `1px solid ${isErr ? 'rgba(239,68,68,0.22)' : 'rgba(124,58,237,0.22)'}`,
                }}
              >
                {/* Top row: badge + name + icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                    borderRadius: '20px',
                    background: isErr ? 'rgba(239,68,68,0.18)' : 'rgba(124,58,237,0.18)',
                    color: isErr ? '#f87171' : '#a78bfa',
                    border: `1px solid ${isErr ? 'rgba(239,68,68,0.35)' : 'rgba(139,92,246,0.35)'}`,
                    letterSpacing: '0.03em',
                  }}>
                    #—
                  </span>
                  <span style={{
                    flex: 1, fontSize: '12px', fontWeight: 500,
                    color: isErr ? '#fca5a5' : '#c4b5fd',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {truncateName(u.name)}
                  </span>
                  {!isErr && pct < 100 && <Spinner size={12} />}
                  {isErr && <AlertCircle size={12} color="#ef4444" style={{ flexShrink: 0 }} />}
                </div>

                {/* Progress bar + label */}
                {!isErr && (
                  <div style={{ marginTop: '7px' }}>
                    {/* Track */}
                    <div style={{
                      height: '4px', borderRadius: '4px', overflow: 'hidden',
                      background: 'rgba(139,92,246,0.18)',
                    }}>
                      {/* Fill */}
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: pct === 100
                          ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                          : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                        borderRadius: '4px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    {/* Label + percent */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginTop: '4px',
                    }}>
                      <span style={{ fontSize: '10px', color: '#7c5cad' }}>
                        {u.label ?? 'Processing…'}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: pct === 100 ? '#4ade80' : '#a78bfa' }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                )}

                {isErr && (
                  <div style={{ fontSize: '10px', color: '#f87171', marginTop: '4px' }}>
                    {u.error || 'Upload failed'}
                  </div>
                )}
              </div>
            );
          })}

          {/* Context documents */}
          {documents.length === 0 && activeUploads.length === 0 && (
            <div style={{
              padding: '16px 8px', textAlign: 'center',
              color: '#2d2d3a', fontSize: '11.5px', lineHeight: 1.6,
            }}>
              No documents yet.<br />Upload one to get started.
            </div>
          )}

          {documents.filter((doc) => !activeDocIds.has(doc.id)).map((doc) => {
            const isReady = doc.status === 'ready';
            const isError = doc.status === 'error' || doc.status === 'failed';
            const isProcessing = !isReady && !isError;
            const isHov = hoveredDocId === doc.id;
            const isConf = confirmDocId === doc.id;
            const isSel = isReady && selectedIds.has(doc.id);

            return (
              <div
                key={doc.id}
                onClick={isReady ? () => toggleSelection(doc.id) : undefined}
                onMouseEnter={() => setHoveredDocId(doc.id)}
                onMouseLeave={() => setHoveredDocId(null)}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '7px 8px', marginBottom: '2px', borderRadius: '9px',
                  background: isSel
                    ? 'rgba(124,58,237,0.14)'
                    : isHov ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: `1px solid ${isSel ? 'rgba(139,92,246,0.3)' : 'transparent'}`,
                  transition: 'background 0.15s, border-color 0.15s',
                  cursor: isReady ? 'pointer' : 'default',
                }}
              >
                {/* ID badge */}
                <span style={{
                  flexShrink: 0,
                  fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                  borderRadius: '20px',
                  background: getDocBadgeBg(doc.status),
                  color: getDocStatusColor(doc.status),
                  border: `1px solid ${getDocStatusColor(doc.status)}40`,
                  letterSpacing: '0.03em', whiteSpace: 'nowrap',
                }}>
                  {isReady ? `#${doc.id}` : '#—'}
                </span>

                {/* File name */}
                <span style={{
                  flex: 1, fontSize: '12px', fontWeight: 500,
                  color: isReady ? '#d1d5db' : isError ? '#fca5a5' : '#a78bfa',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  paddingRight: isHov ? '22px' : 0,
                  transition: 'padding 0.15s',
                }}>
                  {truncateName(doc.name)}
                </span>

                {/* Status icon */}
                {isProcessing && (
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Spinner size={11} />
                  </span>
                )}
                {isReady && !isSel && <CheckCircle size={11} color="#22c55e" style={{ flexShrink: 0 }} />}
                {isReady && isSel && (
                  <div style={{
                    flexShrink: 0, width: '16px', height: '16px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle size={10} color="#fff" />
                  </div>
                )}
                {isError && <AlertCircle size={11} color="#ef4444" style={{ flexShrink: 0 }} />}

                {/* Delete button — only on hover */}
                {isHov && (
                  <button
                    onClick={(e) => handleDeleteDoc(e, doc.id)}
                    title={isConf ? 'Click again to confirm delete' : 'Delete document'}
                    style={{
                      position: 'absolute', right: '6px',
                      width: '20px', height: '20px', borderRadius: '6px',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isConf ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)',
                      color: isConf ? '#f87171' : '#4b5563',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!isConf) e.currentTarget.style.color = '#9ca3af';
                    }}
                    onMouseLeave={(e) => {
                      if (!isConf) e.currentTarget.style.color = '#4b5563';
                    }}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Divider ───────────────────────────────────────── */}
        <div style={{
          height: '1px', background: 'rgba(255,255,255,0.04)',
          flexShrink: 0, margin: '4px 14px 4px',
        }} />

        {/* ── Chat History section ───────────────────────────── */}
        <div style={{ padding: '0 8px 20px', flex: 1 }}>

          {/* Section label */}
          <div style={{
            padding: '8px 8px 4px',
            fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#2d2d3a',
          }}>
            Chats
          </div>

          {/* New Chat button */}
          <button
            onClick={handleNewChat}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 13px', borderRadius: '12px',
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.12))',
              color: '#c4b5fd', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(124,58,237,0.1)',
              marginBottom: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124,58,237,0.28), rgba(99,102,241,0.22))';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,58,237,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.12))';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.1)';
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            New Chat
          </button>

          {/* Conversation list */}
          {conversations.length === 0 ? (
            <div style={{
              padding: '24px 16px', textAlign: 'center',
              color: '#374151', fontSize: '12px', lineHeight: '1.7',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '14px', margin: '0 auto 10px',
                background: 'rgba(124,58,237,0.07)',
                border: '1px solid rgba(139,92,246,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={18} style={{ color: '#374151' }} />
              </div>
              No chats yet.
            </div>
          ) : (
            order.map((label) => (
              <div key={label} style={{ marginBottom: '4px' }}>
                {/* Date bucket label */}
                <div style={{
                  padding: '8px 8px 4px',
                  fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.09em', textTransform: 'uppercase',
                  color: '#1f2937',
                }}>
                  {label}
                </div>

                {buckets[label].map((conv) => {
                  const isActive = conv.id === currentId;
                  const isHov = hoveredChatId === conv.id;
                  const isConf = confirmChatId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectChat(conv.id)}
                      onMouseEnter={() => setHoveredChatId(conv.id)}
                      onMouseLeave={() => setHoveredChatId(null)}
                      style={{
                        position: 'relative',
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '9px 10px', marginBottom: '2px',
                        borderRadius: '10px', cursor: 'pointer',
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.15))'
                          : isHov ? 'rgba(255,255,255,0.04)' : 'transparent',
                        border: `1px solid ${isActive ? 'rgba(139,92,246,0.28)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <MessageSquare
                        size={13}
                        style={{ flexShrink: 0, color: isActive ? '#a78bfa' : '#2d2d3a' }}
                      />
                      <span style={{
                        flex: 1, fontSize: '12.5px', fontWeight: isActive ? 500 : 400,
                        color: isActive ? '#e2d9f3' : '#6b7280',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        paddingRight: isHov ? '26px' : 0,
                        transition: 'padding 0.15s, color 0.15s',
                      }}>
                        {conv.title}
                      </span>

                      {/* Delete button */}
                      {isHov && (
                        <button
                          onClick={(e) => handleDeleteChat(e, conv.id)}
                          title={isConf ? 'Click again to confirm' : 'Delete chat'}
                          style={{
                            position: 'absolute', right: '8px',
                            width: '22px', height: '22px', borderRadius: '6px',
                            border: 'none', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isConf ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)',
                            color: isConf ? '#f87171' : '#4b5563',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isConf) e.currentTarget.style.color = '#9ca3af';
                          }}
                          onMouseLeave={(e) => {
                            if (!isConf) e.currentTarget.style.color = '#4b5563';
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══ Footer ═══════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0, padding: '10px 14px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ fontSize: '10px', color: '#1f2937', textAlign: 'center', lineHeight: 1.5 }}>
          Powered by Google Gemini AI
        </div>
      </div>
    </div>
  );
}
