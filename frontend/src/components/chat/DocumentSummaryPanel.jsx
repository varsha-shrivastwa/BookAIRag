'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Layers, ChevronDown, Sparkles, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { streamSummary, getDocumentSections } from '@/services/documentsApi';
import { useDocuments } from '@/context/DocumentsContext';

// Section picker for a single document
function SectionPicker({ document, onSelect, currentSection }) {
  const [sections, setSections] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getDocumentSections(document.id)
      .then(setSections)
      .catch(() => setSections([]));
  }, [document.id]);

  if (!sections || sections.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '8px',
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.2)',
          cursor: 'pointer', color: '#a78bfa',
          fontSize: '11px', fontWeight: 500,
        }}
      >
        <Layers size={11} />
        {currentSection?.documentId === document.id
          ? currentSection.heading.slice(0, 28) + (currentSection.heading.length > 28 ? '…' : '')
          : 'Summarize section…'}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          marginTop: '4px', borderRadius: '10px', minWidth: '220px', maxWidth: '320px',
          background: '#1a1625', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden',
        }}>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {sections.map((sec) => (
              <button
                key={sec.heading}
                onClick={() => { setOpen(false); onSelect({ documentId: document.id, heading: sec.heading }); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', flexDirection: 'column', gap: '2px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 500 }}>
                  {sec.heading}
                </span>
                <span style={{ fontSize: '9px', color: '#6b7280' }}>
                  {sec.chunkCount} chunks
                  {sec.firstPage ? ` · pg. ${sec.firstPage}${sec.lastPage !== sec.firstPage ? `–${sec.lastPage}` : ''}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DocumentSummaryPanel({ onClose }) {
  const { selectedIds, documents } = useDocuments();
  const selectedDocs = documents.filter((d) => selectedIds.has(d.id) && d.status === 'ready');

  const [summaryText, setSummaryText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(null); // { documentId, heading }
  const scrollRef = useRef(null);
  const streamingRef = useRef(false);

  function startSummary(type, section = null) {
    if (streamingRef.current) return;
    setSummaryText('');
    setError(null);
    setIsStreaming(true);
    streamingRef.current = true;

    streamSummary(
      [...selectedIds],
      type,
      section,
      (chunk) => {
        setSummaryText((prev) => prev + chunk);
        // Auto-scroll
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      },
      () => { setIsStreaming(false); streamingRef.current = false; },
      (err) => {
        setError(err.message || 'Summary failed');
        setIsStreaming(false);
        streamingRef.current = false;
      },
    );
  }

  // Auto-start full summary on open
  useEffect(() => {
    if (selectedIds.size > 0) startSummary('full');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSectionSelect(section) {
    setActiveSection(section);
    startSummary('section', section);
  }

  function handleFullSummary() {
    setActiveSection(null);
    startSummary('full');
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(124,58,237,0.04)',
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookOpen size={14} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
            {activeSection ? `Section: ${activeSection.heading}` : 'Document Summary'}
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px' }}>
            {selectedDocs.length} document{selectedDocs.length !== 1 ? 's' : ''} selected
          </div>
        </div>
        {isStreaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={12} color="#a78bfa" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span style={{ fontSize: '10px', color: '#a78bfa' }}>Generating…</span>
          </div>
        )}
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#6b7280', borderRadius: '6px' }}
          title="Close summary"
        >
          <X size={15} />
        </button>
      </div>

      {/* Section pickers — one per selected document (only when sections exist) */}
      {selectedDocs.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.01)',
        }}>
          <button
            onClick={handleFullSummary}
            disabled={isStreaming}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '8px',
              background: !activeSection ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${!activeSection ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.08)'}`,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              color: !activeSection ? '#c4b5fd' : '#6b7280',
              fontSize: '11px', fontWeight: 500,
            }}
          >
            <FileText size={11} />
            Full summary
          </button>

          {selectedDocs.map((doc) => (
            <SectionPicker
              key={doc.id}
              document={doc}
              currentSection={activeSection}
              onSelect={handleSectionSelect}
            />
          ))}
        </div>
      )}

      {/* Summary content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '16px 18px',
          fontSize: '13px', lineHeight: 1.75, color: '#d1d5db',
        }}
      >
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', fontSize: '12px',
          }}>
            {error}
          </div>
        )}

        {!summaryText && !error && !isStreaming && (
          <div style={{ color: '#4b5563', fontSize: '12px', textAlign: 'center', paddingTop: '40px' }}>
            Select a summary type above to begin.
          </div>
        )}

        {summaryText && (
          <div className="markdown-content" style={{ maxWidth: '720px' }}>
            <ReactMarkdown>{summaryText}</ReactMarkdown>
          </div>
        )}

        {isStreaming && !summaryText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '12px' }}>
            <Sparkles size={14} color="#a78bfa" style={{ animation: 'spin 1.5s linear infinite' }} />
            Reading your documents…
          </div>
        )}
      </div>
    </div>
  );
}
