'use client';

import React, { useState, useRef } from 'react';
import { FileText, Trash2, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react';
import { useDocuments } from '@/context/DocumentsContext';
import { retryDocument, streamUploadProgress } from '@/services/documentsApi';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CONFIG = {
  ready:      { color: '#34d399', label: 'Ready',      Icon: CheckCircle },
  uploading:  { color: '#fbbf24', label: 'Uploading',  Icon: Loader },
  extracting: { color: '#fbbf24', label: 'Extracting', Icon: Loader },
  analyzing:  { color: '#fbbf24', label: 'Analyzing',  Icon: Loader },
  indexing:   { color: '#fbbf24', label: 'Indexing',   Icon: Loader },
  error:      { color: '#f87171', label: 'Error',      Icon: AlertCircle },
};

export function DocumentItem({ document }) {
  const { removeDocument, toggleSelection, isSelected, updateDocument } = useDocuments();
  const [hovered, setHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const progressAbortRef = useRef(null);

  const cfg = STATUS_CONFIG[document.status] || STATUS_CONFIG.uploading;
  const isReady = document.status === 'ready';
  const isProcessing = ['uploading','extracting','analyzing','indexing'].includes(document.status);
  const selected = isSelected(document.id);

  async function handleDelete(e) {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    progressAbortRef.current?.abort();
    try { await removeDocument(document.id); }
    catch { setDeleting(false); }
  }

  async function handleRetry(e) {
    e.stopPropagation();
    if (retrying) return;
    setRetrying(true);

    try {
      await retryDocument(document.id);
      updateDocument(document.id, { status: 'uploading', canRetry: false, errorMessage: null });

      const ctl = streamUploadProgress(
        document.id,
        (stage) => updateDocument(document.id, { status: stage }),
        (doneData) => {
          updateDocument(document.id, { status: 'ready', chunkCount: doneData.chunkCount });
          setRetrying(false);
        },
        (errMsg) => {
          updateDocument(document.id, { status: 'error', errorMessage: errMsg, canRetry: (document.retryCount || 0) + 1 < 3 });
          setRetrying(false);
        },
      );
      progressAbortRef.current = ctl;
    } catch (err) {
      updateDocument(document.id, { status: 'error', errorMessage: err.message });
      setRetrying(false);
    }
  }

  return (
    <div
      onClick={() => isReady && toggleSelection(document.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
        cursor: isReady ? 'pointer' : 'default',
        background: selected
          ? 'rgba(124,58,237,0.12)'
          : hovered
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(255,255,255,0.02)',
        border: `1px solid ${selected ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.06)'}`,
        transition: 'all 0.2s',
      }}
    >
      {/* Checkbox */}
      {isReady && (
        <div style={{
          width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, marginTop: '2px',
          background: selected ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${selected ? 'transparent' : 'rgba(255,255,255,0.15)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700 }}>✓</span>}
        </div>
      )}

      {/* File icon */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
        background: 'rgba(124,58,237,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FileText size={15} color="#a78bfa" />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px', fontWeight: 500, color: '#e2e8f0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '140px',
        }} title={document.name}>
          {document.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
          <span style={{ fontSize: '10px', color: '#6b7280' }}>{formatBytes(document.sizeBytes)}</span>
          <span style={{ fontSize: '10px', color: '#374151' }}>·</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {isProcessing
              ? <cfg.Icon size={9} color={cfg.color} style={{ animation: 'spin 1s linear infinite' }} />
              : <cfg.Icon size={9} color={cfg.color} />
            }
            <span style={{ fontSize: '10px', color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
          </div>
          {isReady && document.chunkCount > 0 && (
            <>
              <span style={{ fontSize: '10px', color: '#374151' }}>·</span>
              <span style={{ fontSize: '10px', color: '#6b7280' }}>{document.chunkCount} chunks</span>
            </>
          )}
        </div>
        {document.status === 'error' && document.errorMessage && (
          <div style={{ fontSize: '10px', color: '#f87171', marginTop: '4px', lineHeight: 1.4 }}>
            {document.errorMessage.slice(0, 80)}
          </div>
        )}
        {/* Retry count indicator */}
        {document.status === 'error' && document.retryCount > 0 && (
          <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
            Attempt {document.retryCount + 1} of 3
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        {/* Retry button — only for failed documents that can be retried */}
        {document.canRetry && !retrying && (
          <button
            onClick={handleRetry}
            title="Retry processing"
            style={{
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
              cursor: 'pointer', padding: '3px 6px', borderRadius: '6px',
              color: '#fbbf24',
              display: 'flex', alignItems: 'center', gap: '3px',
              fontSize: '9px', fontWeight: 600,
              opacity: hovered ? 1 : 0.7,
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={10} />
            Retry
          </button>
        )}
        {retrying && (
          <span style={{ fontSize: '9px', color: '#fbbf24', padding: '3px 0' }}>Retrying…</span>
        )}

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            background: 'none', border: 'none', cursor: deleting ? 'wait' : 'pointer',
            padding: '3px', borderRadius: '6px',
            color: hovered ? '#f87171' : '#4b5563',
            opacity: hovered ? 1 : 0,
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center',
          }}
          title="Remove document"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
