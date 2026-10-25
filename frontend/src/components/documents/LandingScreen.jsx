'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileText, Sparkles } from 'lucide-react';
import { useDocuments } from '@/context/DocumentsContext';
import { UploadProgressSteps } from './UploadProgressSteps';
import { uploadDocument, streamUploadProgress } from '@/services/documentsApi';

const ALLOWED_EXTENSIONS = '.pdf,.docx,.txt,.md,.xlsx,.csv';
const MAX_SIZE_MB = 20;

const FORMAT_BADGES = [
  { label: 'PDF',      color: '#ef4444' },
  { label: 'DOCX',     color: '#3b82f6' },
  { label: 'TXT',      color: '#94a3b8' },
  { label: 'Markdown', color: '#a78bfa' },
  { label: 'Excel',    color: '#22c55e' },
  { label: 'CSV',      color: '#f59e0b' },
];

const UPLOAD_STAGE_MESSAGES = {
  uploading:  'Uploading document',
  extracting: 'Extracting content',
  analyzing:  'Analyzing structure',
  indexing:   'Indexing document',
  ready:      'Document ready',
};

export function LandingScreen() {
  const { addDocument, updateDocument } = useDocuments();
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState(null);

  const handleFiles = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    setUploadState({ stage: 'uploading', message: 'Uploading...', isError: false, fileName: file.name });

    let docId;
    try {
      const result = await uploadDocument(file, (pct) => {
        setUploadState((s) => ({ ...s, message: `Uploading… ${pct}%` }));
      });
      docId = result.documentId;

      // Optimistically add to list — this will cause documents.length > 0,
      // triggering page.js to unmount LandingScreen and show the two-pane layout.
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

    // SSE progress continues after component unmounts; updateDocument is context-stable
    streamUploadProgress(
      docId,
      (stage, message, progressData) => {
        setUploadState((s) => s && ({
          ...s,
          stage,
          message: UPLOAD_STAGE_MESSAGES[stage] || message,
          indexingProgress: progressData,
        }));
        updateDocument(docId, { status: stage });
      },
      (doneData) => {
        updateDocument(docId, { status: 'ready', chunkCount: doneData.chunkCount });
      },
      (errMsg) => {
        setUploadState((s) => s && ({ ...s, stage: 'error', message: errMsg, isError: true }));
        updateDocument(docId, { status: 'error', errorMessage: errMsg });
      },
    );
  }, [addDocument, updateDocument]);

  const onFileChange = (e) => { handleFiles(e.target.files); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); };

  return (
    <div style={{ textAlign: 'center', padding: '40px 24px', maxWidth: '540px', width: '100%' }}>

      {/* Floating icon */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '24px',
            background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
            filter: 'blur(18px)', opacity: 0.5,
          }} />
          <div style={{
            position: 'relative', width: '88px', height: '88px', borderRadius: '24px',
            background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(124,58,237,0.45)',
            animation: 'float 6s ease-in-out infinite',
          }}>
            <FileText size={40} color="#fff" strokeWidth={1.8} />
          </div>
          <span style={{
            position: 'absolute', top: '-10px', right: '-10px',
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(251,191,36,0.4)',
          }}>
            <Sparkles size={14} color="#fff" />
          </span>
        </div>
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 800, lineHeight: 1.2, marginBottom: '12px',
      }}>
        <span style={{
          background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 40%, #ec4899 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Chat with Your</span>
        <br />
        <span style={{ color: '#f1f5f9' }}>Documents</span>
      </h1>
      <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: 1.7, marginBottom: '32px' }}>
        Upload a document and ask anything about its content.
      </p>

      {/* Upload zone or progress */}
      {uploadState ? (
        <div style={{
          padding: '20px 24px', borderRadius: '16px', textAlign: 'left',
          background: 'rgba(124,58,237,0.06)',
          border: `1px solid ${uploadState.isError ? 'rgba(239,68,68,0.25)' : 'rgba(124,58,237,0.2)'}`,
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#c4b5fd', marginBottom: '12px' }}>
            {uploadState.fileName}
          </p>
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
            border: `2px dashed ${dragging ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '16px', padding: '36px 24px',
            background: dragging ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
          }}
        >
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'rgba(124,58,237,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Upload size={22} color="#a78bfa" />
          </div>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#c4b5fd', margin: '0 0 4px' }}>
              Drag &amp; drop your file here
            </p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              or click to browse from your computer
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{
              padding: '10px 30px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: '#fff', fontSize: '14px', fontWeight: 600,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
              fontFamily: 'inherit', transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Browse Files
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {/* Format badges */}
      <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {FORMAT_BADGES.map((f) => (
          <span key={f.label} style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '9999px',
            background: `${f.color}18`, color: f.color,
            border: `1px solid ${f.color}30`,
          }}>
            {f.label}
          </span>
        ))}
        <span style={{
          fontSize: '11px', color: '#4b5563', padding: '3px 10px', borderRadius: '9999px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          max 20 MB
        </span>
      </div>
    </div>
  );
}
