'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, FileText, Table2, BarChart2, Image, Copy, Check } from 'lucide-react';

const CONTENT_TYPE_CONFIG = {
  table:  { label: 'Table',   Icon: Table2,   color: '#34d399' },
  chart:  { label: 'Chart',   Icon: BarChart2, color: '#60a5fa' },
  image:  { label: 'Diagram', Icon: Image,     color: '#f472b6' },
  ocr:    { label: 'Scanned', Icon: FileText,  color: '#fbbf24' },
  text:   { label: 'Text',    Icon: FileText,  color: '#9ca3af' },
};

function ContentTypeBadge({ type }) {
  const cfg = CONTENT_TYPE_CONFIG[type] || CONTENT_TYPE_CONFIG.text;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 6px', borderRadius: '9999px', flexShrink: 0,
      background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30`,
    }}>
      <cfg.Icon size={8} />
      {cfg.label}
    </span>
  );
}

/** Formats a structured citation string for copying */
function formatCitation(s) {
  const parts = [s.documentName];
  if (s.pageNumber) parts.push(`page ${s.pageNumber}`);
  if (s.sectionHeading) parts.push(`§ ${s.sectionHeading}`);
  if (s.figureLabel) parts.push(s.figureLabel);
  return parts.join(', ');
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy citation"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '9px', color: copied ? '#34d399' : '#a78bfa',
        background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(124,58,237,0.1)',
        border: `1px solid ${copied ? 'rgba(52,211,153,0.25)' : 'rgba(124,58,237,0.2)'}`,
        borderRadius: '5px', padding: '2px 7px', cursor: 'pointer',
        transition: 'all 0.2s', flexShrink: 0,
      }}
    >
      {copied ? <Check size={9} /> : <Copy size={9} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SourceCard({ source, isActive, onActivate }) {
  const [expanded, setExpanded] = useState(false);
  const n = source.citationNumber;
  const cfg = CONTENT_TYPE_CONFIG[source.contentType] || CONTENT_TYPE_CONFIG.text;
  const citationText = formatCitation(source);

  const handleClick = () => {
    setExpanded((v) => !v);
    onActivate?.(n);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '8px 10px',
        borderRadius: '9px',
        border: `1px solid ${isActive ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.05)'}`,
        background: isActive ? 'rgba(124,58,237,0.07)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      {/* ── Row 1: number + doc name + page + type + chevron ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
        {/* Citation number badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: '20px', height: '20px', padding: '0 4px', borderRadius: '6px',
          background: isActive ? '#7c3aed' : 'rgba(124,58,237,0.18)',
          color: isActive ? '#fff' : '#a78bfa',
          fontSize: '10px', fontWeight: 800, fontFamily: 'monospace', flexShrink: 0,
          transition: 'all 0.2s',
        }}>
          {n}
        </span>

        {/* Document name */}
        <span style={{
          fontSize: '10px', fontWeight: 600, color: '#c4b5fd',
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={source.documentName}>
          {source.documentName}
        </span>

        {/* Page badge */}
        {source.pageNumber != null && (
          <span style={{
            fontSize: '9px', color: '#a78bfa', fontWeight: 600, flexShrink: 0,
            padding: '1px 6px', borderRadius: '9999px',
            background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
          }}>
            p.{source.pageNumber}
          </span>
        )}

        <ContentTypeBadge type={source.contentType} />

        {expanded
          ? <ChevronUp size={11} color="#6b7280" style={{ flexShrink: 0 }} />
          : <ChevronDown size={11} color="#6b7280" style={{ flexShrink: 0 }} />}
      </div>

      {/* ── Row 2: section heading + figure label ── */}
      {(source.sectionHeading || source.figureLabel) && (
        <div style={{
          display: 'flex', gap: '8px', marginTop: '4px', paddingLeft: '26px',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          {source.sectionHeading && (
            <span style={{
              fontSize: '9px', color: '#6b7280',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '220px',
            }} title={source.sectionHeading}>
              § {source.sectionHeading}
            </span>
          )}
          {source.figureLabel && (
            <span style={{
              fontSize: '9px', fontWeight: 600, color: cfg.color,
              padding: '1px 6px', borderRadius: '9999px',
              background: `${cfg.color}15`, border: `1px solid ${cfg.color}25`,
            }}>
              {source.figureLabel}
            </span>
          )}
        </div>
      )}

      {/* ── Excerpt (always shown, clamped unless expanded) ── */}
      <div style={{ marginTop: '5px', paddingLeft: '26px' }}>
        <p style={{
          fontSize: '11px', color: '#9ca3af', margin: 0,
          lineHeight: 1.6, fontStyle: 'italic',
          ...(expanded
            ? {}
            : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}>
          "{source.excerpt}{!expanded && source.excerpt?.length >= 250 ? '…' : ''}"
        </p>
      </div>

      {/* ── Expanded footer: formatted citation + copy button ── */}
      {expanded && (
        <div style={{
          marginTop: '8px', paddingLeft: '26px',
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '9px', color: '#4b5563', fontStyle: 'italic', flex: 1, minWidth: 0 }}>
            {citationText}
          </span>
          <CopyButton text={citationText} />
        </div>
      )}
    </div>
  );
}

export function DocSourcesPanel({ sources, activeCitation, onCitationClick }) {
  const cardRefs = useRef({});

  // Scroll active citation card into view when it changes
  useEffect(() => {
    if (activeCitation == null) return;
    const el = cardRefs.current[activeCitation];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeCitation]);

  if (!sources || sources.length === 0) return null;

  const typeCounts = ['table', 'chart', 'image', 'ocr'].reduce((acc, t) => {
    const count = sources.filter((s) => s.contentType === t).length;
    if (count) acc[t] = count;
    return acc;
  }, {});

  return (
    <div style={{
      marginTop: '10px', borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
    }}>
      {/* ── Header (always visible) ── */}
      <div style={{
        padding: '7px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <BookOpen size={11} color="#a78bfa" />
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', flex: 1 }}>
          {sources.length} source{sources.length !== 1 ? 's' : ''} cited
        </span>
        {Object.entries(typeCounts).map(([type, count]) => {
          const cfg = CONTENT_TYPE_CONFIG[type];
          return (
            <span key={type} style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: '9999px',
              background: `${cfg.color}18`, color: cfg.color,
            }}>
              {count} {cfg.label}
            </span>
          );
        })}
      </div>

      {/* ── Source cards ── */}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {sources.map((s) => (
          <div
            key={s.citationNumber}
            ref={(el) => { cardRefs.current[s.citationNumber] = el; }}
          >
            <SourceCard
              source={s}
              isActive={activeCitation === s.citationNumber}
              onActivate={onCitationClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
