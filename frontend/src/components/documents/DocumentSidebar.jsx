'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckSquare, Square, X } from 'lucide-react';
import { useDocuments } from '@/context/DocumentsContext';
import { DocumentItem } from './DocumentItem';
import { UploadProgressSteps } from './UploadProgressSteps';
import { uploadDocument, streamUploadProgress } from '@/services/documentsApi';

const ALLOWED_EXTENSIONS = '.pdf,.docx,.txt,.md,.xlsx,.csv';
const MAX_SIZE_MB = 20;

const UPLOAD_STAGE_MESSAGES = {
  uploading:  'Uploading document',
  extracting: 'Extracting content',
  analyzing:  'Analyzing structure',
  indexing:   'Indexing document',
  ready:      'Document ready',
};

export function DocumentSidebar({ collapsed, onMobileClose }) {
  const { documents, loadDocuments, addDocument, updateDocument, selectedIds, selectAll, clearSelection } = useDocuments();
  const fileInputRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState(null); // null | { stage, message, isError, fileName }

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleFiles = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    setUploadState({ stage: 'uploading', message: 'Uploading document...', isError: false, fileName: file.name });

    let docId;
    try {
      const result = await uploadDocument(file, (pct) => {
        setUploadState((s) => ({ ...s, message: `Uploading… ${pct}%` }));
      });
      docId = result.documentId;

      // Optimistically add to list
      addDocument({
        id: docId,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        status: 'uploading',
        chunkCount: 0,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setUploadState({ stage: 'error', message: err.message, isError: true, fileName: file.name });
      setTimeout(() => setUploadState(null), 4000);
      return;
    }

    // Stream progress
    streamUploadProgress(
      docId,
      (stage, message, progressData) => {
        setUploadState((s) => ({
          ...s,
          stage,
          message: UPLOAD_STAGE_MESSAGES[stage] || message,
          // progressData = { percent, indexed, total } during indexing, null otherwise
          indexingProgress: progressData,
        }));
        updateDocument(docId, { status: stage });
      },
      (doneData) => {
        updateDocument(docId, {
          status: 'ready',
          chunkCount: doneData.chunkCount,
        });
        setTimeout(() => setUploadState(null), 1500);
      },
      (errMsg) => {
        setUploadState((s) => ({ ...s, stage: 'error', message: errMsg, isError: true }));
        updateDocument(docId, { status: 'error', errorMessage: errMsg });
        setTimeout(() => setUploadState(null), 4000);
      },
    );
  }, [addDocument, updateDocument]);

  const onFileChange = (e) => { handleFiles(e.target.files); e.target.value = ''; };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const readyCount = documents.filter((d) => d.status === 'ready').length;
  const allSelected = selectedIds.size === readyCount && readyCount > 0;

  if (collapsed) return null;

  return (
    <div style={{
      width: '280px', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      height: '100%',
      background: 'rgba(255,255,255,0.02)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={15} color="#a78bfa" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Documents</span>
          {documents.length > 0 && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px',
              background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.2)',
            }}>{documents.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {readyCount > 0 && (
            <button
              onClick={allSelected ? clearSelection : selectAll}
              title={allSelected ? 'Deselect all' : 'Select all ready'}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', padding:'3px', borderRadius:'6px' }}
            >
              {allSelected ? <CheckSquare size={14} color="#a78bfa" /> : <Square size={14} />}
            </button>
          )}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              title="Close"
              style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', padding:'3px', borderRadius:'6px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Upload zone */}
      <div style={{ padding: '12px 12px 8px' }}>
        {uploadState ? (
          <div style={{
            padding: '12px', borderRadius: '10px',
            background: 'rgba(124,58,237,0.06)',
            border: `1px solid ${uploadState.isError ? 'rgba(239,68,68,0.25)' : 'rgba(124,58,237,0.2)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#c4b5fd' }}>
                {uploadState.fileName}
              </span>
              <button
                onClick={() => setUploadState(null)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', padding:'0' }}
              >
                <X size={12} />
              </button>
            </div>
            <UploadProgressSteps
              currentStage={uploadState.stage}
              isError={uploadState.isError}
              indexingProgress={uploadState.indexingProgress}
            />
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              border: `1.5px dashed ${dragging ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px', padding: '18px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              cursor: 'pointer',
              background: dragging ? 'rgba(124,58,237,0.06)' : 'transparent',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(124,58,237,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={16} color="#a78bfa" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: '#c4b5fd', margin: 0 }}>
                Drop files or click to upload
              </p>
              <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>
                PDF, DOCX, TXT, MD, XLSX, CSV · max 20 MB
              </p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>

      {/* Document list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        {documents.length === 0 && !uploadState ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#4b5563' }}>
            <FileText size={28} color="#374151" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: '12px', lineHeight: 1.6 }}>
              No documents uploaded yet.<br />Upload a file to get started.
            </p>
          </div>
        ) : (
          documents.map((doc) => <DocumentItem key={doc.id} document={doc} />)
        )}
      </div>

      {/* Footer hint */}
      {readyCount > 0 && (
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '10px', color: '#4b5563', lineHeight: 1.5,
        }}>
          {selectedIds.size > 0
            ? `${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''} selected — chat will use these`
            : 'Select documents to include in chat context'}
        </div>
      )}
    </div>
  );
}
