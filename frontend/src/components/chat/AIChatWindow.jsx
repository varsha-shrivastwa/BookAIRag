'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, User, Copy, Check, Sparkles, Send, Loader2,
  FileText, AlertTriangle, ChevronDown, ChevronUp, Cpu, Plus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useConversations } from '@/context/ConversationsContext';
import { useDocuments } from '@/context/DocumentsContext';
import { useAuth } from '@/context/AuthContext';
import { streamAiChat, streamDocChat, generateChatTitle } from '@/services/aiChatApi';

/* ── Suggestion prompts shown on the welcome screen ─────────────── */
const SUGGESTIONS = [
  { label: 'Explain quantum computing simply', icon: '⚛️' },
  { label: 'Write a Python quicksort function', icon: '🐍' },
  { label: 'Best practices for REST API design', icon: '🔌' },
  { label: 'Differences between SQL and NoSQL', icon: '🗄️' },
  { label: 'How does machine learning work?', icon: '🤖' },
  { label: 'Summarize the SOLID principles', icon: '📐' },
];

/* ── Free-tier Gemini models available for selection ─────────────── */
const FREE_MODELS = [
  { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      rpd: 1500, badge: 'Recommended', badgeColor: '#22c55e' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', rpd: 1500, badge: 'Fastest',     badgeColor: '#3b82f6' },
  { id: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash',      rpd: 1500, badge: '',             badgeColor: null      },
  { id: 'gemini-1.5-flash-8b',   label: 'Gemini 1.5 Flash 8B',  rpd: 1500, badge: 'Lightweight',  badgeColor: '#f59e0b' },
  { id: 'gemini-1.5-pro',        label: 'Gemini 1.5 Pro',        rpd: 50,   badge: 'Powerful',     badgeColor: '#a78bfa' },
  { id: 'gemini-3.6-flash',      label: 'Gemini 3.6 Flash',      rpd: 20,   badge: 'Low quota',    badgeColor: '#ef4444' },
];

/* ── Tiny ID generator ───────────────────────────────────────────── */
function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ── Parse hashtag references from message text ─────────────────── */
function parseHashtagRefs(text, documents) {
  const matches = [...text.matchAll(/#(\d+)\b/g)];
  const docIds = [];
  const notFound = [];
  const notReady = [];
  const seen = new Set();
  for (const m of matches) {
    const id = parseInt(m[1], 10);
    if (seen.has(id)) continue;
    seen.add(id);
    const doc = documents.find((d) => d.id === id);
    if (!doc) notFound.push(id);
    else if (doc.status !== 'ready') notReady.push({ id, name: doc.name, status: doc.status });
    else docIds.push(id);
  }
  return { docIds, notFound, notReady };
}

/* ── Copy button ─────────────────────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      title={copied ? 'Copied!' : 'Copy response'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', borderRadius: '6px',
        background: 'none', border: '1px solid transparent',
        color: copied ? '#a78bfa' : '#374151',
        cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.color = copied ? '#a78bfa' : '#6b7280';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.color = copied ? '#a78bfa' : '#374151';
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/* ── Expandable source card ──────────────────────────────────────── */
function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderRadius: '10px',
        background: 'rgba(124,58,237,0.06)',
        border: '1px solid rgba(139,92,246,0.18)',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded((v) => !v)}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.18)'; }}
    >
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px',
        padding: '8px 10px',
      }}>
        {/* Citation number */}
        <span style={{
          flexShrink: 0,
          width: '20px', height: '20px', borderRadius: '6px',
          background: 'rgba(124,58,237,0.2)',
          border: '1px solid rgba(139,92,246,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 700, color: '#a78bfa',
        }}>
          {source.citationNumber ?? index + 1}
        </span>

        {/* Doc name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px', fontWeight: 600, color: '#c4b5fd',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {source.documentName || 'Source'}
          </div>
          <div style={{ fontSize: '10.5px', color: '#4b5563', marginTop: '1px', display: 'flex', gap: '8px' }}>
            {source.pageNumber != null && (
              <span>p.{source.pageNumber}</span>
            )}
            {source.sectionHeading && (
              <span style={{
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                maxWidth: '150px',
              }}>
                {source.sectionHeading}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <span style={{ flexShrink: 0, color: '#4b5563', marginTop: '2px' }}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </div>

      {/* Expanded excerpt */}
      {expanded && source.excerpt && (
        <div style={{
          padding: '0 10px 10px',
          fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.6,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          paddingTop: '8px',
        }}>
          {source.excerpt}
        </div>
      )}
    </div>
  );
}

/* ── Single message bubble ───────────────────────────────────────── */
function Bubble({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  /* System warning messages */
  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          display: 'flex', justifyContent: 'center',
          padding: '3px 0',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '8px',
          padding: '9px 13px', borderRadius: '12px', maxWidth: '580px',
          background: 'rgba(234,179,8,0.07)',
          border: '1px solid rgba(234,179,8,0.2)',
          color: '#fbbf24', fontSize: '12.5px', lineHeight: 1.55,
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{message.content}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        display: 'flex',
        gap: '12px',
        padding: '3px 0',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-start',
      }}
    >
      {/* Bot avatar */}
      {!isUser && (
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          marginTop: '2px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(124,58,237,0.35)',
          border: '2px solid rgba(139,92,246,0.18)',
        }}>
          <Bot size={15} color="#fff" strokeWidth={2} />
        </div>
      )}

      <div style={{ maxWidth: 'min(78%, 680px)' }}>
        {/* Bubble body */}
        {isUser ? (
          <div style={{
            padding: '11px 15px',
            borderRadius: '18px', borderTopRightRadius: '4px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            color: '#fff', fontSize: '14px', lineHeight: '1.65',
            boxShadow: '0 4px 18px rgba(124,58,237,0.22)',
            border: '1px solid rgba(167,139,250,0.18)',
            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          }}>
            {message.content}
          </div>
        ) : (
          <div>
            <div style={{
              padding: '12px 16px',
              borderRadius: '18px', borderTopLeftRadius: '4px',
              background: 'rgba(255,255,255,0.046)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.075)',
              color: '#e2e8f0', fontSize: '14px', lineHeight: '1.65',
            }}>
              <div style={{ lineHeight: '1.72' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p:    ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                    strong:({ children }) => <strong style={{ color: '#c4b5fd', fontWeight: 700 }}>{children}</strong>,
                    em:   ({ children }) => <em style={{ color: '#94a3b8' }}>{children}</em>,
                    h1:   ({ children }) => <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9', margin: '12px 0 6px' }}>{children}</h1>,
                    h2:   ({ children }) => <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: '10px 0 5px' }}>{children}</h2>,
                    h3:   ({ children }) => <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', margin: '8px 0 4px' }}>{children}</h3>,
                    ul:   ({ children }) => <ul style={{ paddingLeft: '18px', margin: '6px 0' }}>{children}</ul>,
                    ol:   ({ children }) => <ol style={{ paddingLeft: '18px', margin: '6px 0' }}>{children}</ol>,
                    li:   ({ children }) => <li style={{ margin: '3px 0', color: '#cbd5e1' }}>{children}</li>,
                    a:    ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>{children}</a>,
                    pre: ({ children }) => (
                      <pre style={{ background: 'rgba(0,0,0,0.38)', borderRadius: '8px', padding: '12px 14px', overflowX: 'auto', margin: '8px 0' }}>
                        {children}
                      </pre>
                    ),
                    code: ({ inline, className, children }) => {
                      const isInline = inline === true || (inline === undefined && className === undefined);
                      return isInline
                        ? <code style={{ background: 'rgba(139,92,246,0.18)', borderRadius: '4px', padding: '1px 5px', fontSize: '12px', fontFamily: 'var(--font-mono,monospace)', color: '#c4b5fd' }}>{children}</code>
                        : <code style={{ fontSize: '12px', fontFamily: 'var(--font-mono,monospace)', color: '#e2e8f0' }}>{children}</code>;
                    },
                    blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #7c3aed', paddingLeft: '12px', margin: '8px 0', color: '#94a3b8', fontStyle: 'italic' }}>{children}</blockquote>,
                    table: ({ children }) => <div style={{ overflowX: 'auto', margin: '8px 0' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>{children}</table></div>,
                    thead: ({ children }) => <thead>{children}</thead>,
                    th:   ({ children }) => <th style={{ padding: '6px 10px', background: 'rgba(124,58,237,0.18)', color: '#c4b5fd', textAlign: 'left', borderBottom: '1px solid rgba(139,92,246,0.25)', fontWeight: 700 }}>{children}</th>,
                    td:   ({ children }) => <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#d1d5db' }}>{children}</td>,
                    hr:   () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0' }} />,
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {/* Blinking cursor while streaming */}
                {message.isStreaming && (
                  <span style={{
                    display: 'inline-block', width: '2px', height: '14px',
                    background: '#a78bfa', marginLeft: '2px', verticalAlign: 'middle',
                    animation: 'blink 0.9s step-end infinite',
                  }} />
                )}
              </div>
            </div>

          </div>
        )}

        {/* Metadata row */}
        <div style={{
          display: 'flex', alignItems: 'center', marginTop: '5px',
          gap: '4px', paddingLeft: '4px', paddingRight: '4px',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
        }}>
          <span style={{ fontSize: '10px', color: '#1f2937' }}>
            {isUser ? 'You' : 'DocAI'}
          </span>
          {!isUser && !message.isStreaming && message.content && (
            <CopyBtn text={message.content} />
          )}
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          marginTop: '2px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6b7280',
        }}>
          <User size={14} strokeWidth={2} />
        </div>
      )}
    </motion.div>
  );
}

/* ── Welcome / empty-state screen ──────────────────────────────── */
function WelcomeScreen({ userName, onSuggestion }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px 24px', textAlign: 'center',
    }}>
      {/* Icon */}
      <div style={{ position: 'relative', marginBottom: '26px' }}>
        <div style={{
          position: 'absolute', inset: '-8px', borderRadius: '28px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
          filter: 'blur(14px)', opacity: 0.35,
        }} />
        <div style={{
          position: 'relative',
          width: '72px', height: '72px', borderRadius: '22px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 28px rgba(124,58,237,0.38)',
          margin: '0 auto',
        }}>
          <Sparkles size={30} color="#fff" strokeWidth={1.8} />
        </div>
      </div>

      {/* Greeting */}
      <h1 style={{
        fontSize: 'clamp(22px, 4.5vw, 34px)', fontWeight: 800,
        margin: '0 0 10px',
        background: 'linear-gradient(135deg, #f1f5f9 20%, #c4b5fd 60%, #ec4899 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        lineHeight: 1.2,
      }}>
        Hello{userName ? `, ${userName.split(' ')[0]}` : ''}!
        <br />How can I help you today?
      </h1>
      <p style={{
        color: '#4b5563', fontSize: '14px', margin: '0 0 16px',
        maxWidth: '400px', lineHeight: 1.65,
      }}>
        Ask me anything, or use{' '}
        <code style={{
          background: 'rgba(124,58,237,0.15)', borderRadius: '4px',
          padding: '1px 5px', fontSize: '12px', color: '#a78bfa',
        }}>
          #12
        </code>{' '}
        to reference a document by its ID.
      </p>

      {/* Suggestion grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '10px', width: '100%', maxWidth: '600px',
        marginTop: '20px',
      }}>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s.label)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '13px 14px', borderRadius: '13px', textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.025)',
              color: '#6b7280', cursor: 'pointer',
              fontSize: '12.5px', lineHeight: '1.4', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
              e.currentTarget.style.background = 'rgba(124,58,237,0.08)';
              e.currentTarget.style.color = '#c4b5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <span style={{ fontSize: '15px', flexShrink: 0, lineHeight: 1.3 }}>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Hashtag preview row shown inside the input area ─────────────── */
function HashtagPreview({ text, documents }) {
  const hasHashtags = /#\d+\b/.test(text);
  if (!hasHashtags) return null;

  const { docIds, notFound, notReady } = parseHashtagRefs(text, documents);

  const chips = [
    ...docIds.map((id) => {
      const doc = documents.find((d) => d.id === id);
      return { id, label: doc?.name || `#${id}`, state: 'ready' };
    }),
    ...notReady.map(({ id, name }) => ({ id, label: name || `#${id}`, state: 'notReady' })),
    ...notFound.map((id) => ({ id, label: `#${id}`, state: 'notFound' })),
  ];

  if (chips.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px',
      padding: '6px 0 4px',
    }}>
      <span style={{ fontSize: '10.5px', color: '#4b5563', flexShrink: 0 }}>
        Referencing:
      </span>
      {chips.map((chip) => {
        const color = chip.state === 'ready' ? '#22c55e'
          : chip.state === 'notReady' ? '#f59e0b'
          : '#ef4444';
        const bg = chip.state === 'ready' ? 'rgba(34,197,94,0.1)'
          : chip.state === 'notReady' ? 'rgba(245,158,11,0.1)'
          : 'rgba(239,68,68,0.1)';
        const title = chip.state === 'ready' ? 'Ready'
          : chip.state === 'notReady' ? 'Still processing — will send when ready'
          : 'Not found';

        return (
          <span
            key={chip.id}
            title={title}
            style={{
              fontSize: '10.5px', fontWeight: 600,
              padding: '2px 7px', borderRadius: '20px',
              background: bg,
              border: `1px solid ${color}40`,
              color,
              maxWidth: '130px',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}
          >
            #{chip.id} {chip.state !== 'notFound' && `· ${chip.label.length > 14 ? chip.label.slice(0, 14) + '…' : chip.label}`}
            {chip.state === 'notFound' && ' · not found'}
            {chip.state === 'notReady' && ' · processing'}
          </span>
        );
      })}
    </div>
  );
}

/* ── Chat input bar ─────────────────────────────────────────────── */
function ChatInputBar({ onSend, isLoading, documents }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const textRef = useRef(null);
  const modelPickerRef = useRef(null);
  const LIMIT = 4000;

  /* Close model picker when clicking outside */
  useEffect(() => {
    if (!showModelPicker) return;
    const handleOutside = (e) => {
      if (!modelPickerRef.current?.contains(e.target)) setShowModelPicker(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showModelPicker]);

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || trimmed.length > LIMIT) return;
    onSend(trimmed, selectedModel);
    setText('');
  }, [text, isLoading, onSend, selectedModel]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const canSend = text.trim().length > 0 && !isLoading && text.length <= LIMIT;
  const remaining = LIMIT - text.length;
  const nearLimit = remaining < 200;

  return (
    <div>
      {/* Hashtag preview row */}
      <HashtagPreview text={text} documents={documents} />

      <div style={{ position: 'relative' }}>
        {/* Outer glow ring on focus */}
        <div style={{
          position: 'absolute', inset: '-1px', borderRadius: '18px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
          filter: 'blur(8px)', opacity: focused ? 0.45 : 0,
          transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 0,
        }} />

        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'flex-end', gap: '8px',
          padding: '12px 14px',
          borderRadius: '18px',
          background: 'rgba(12, 8, 26, 0.88)',
          backdropFilter: 'blur(24px)',
          border: `1.5px solid ${focused ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.07)'}`,
          boxShadow: focused ? '0 0 0 4px rgba(124,58,237,0.1)' : '0 4px 24px rgba(0,0,0,0.32)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}>

          {/* Textarea */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              ref={textRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={isLoading}
              placeholder="Ask anything… or use #12 to reference a document"
              maxLength={LIMIT}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', color: '#f1f5f9', fontSize: '14px', lineHeight: '1.6',
                minHeight: '26px', maxHeight: '180px', fontFamily: 'inherit',
                opacity: isLoading ? 0.5 : 1,
              }}
            />
            {nearLimit && (
              <span style={{
                fontSize: '10px', fontFamily: 'monospace',
                color: remaining <= 0 ? '#f87171' : 'rgba(234,179,8,0.65)',
              }}>
                {remaining}
              </span>
            )}
          </div>

          {/* Model picker button + dropdown */}
          <div ref={modelPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowModelPicker((v) => !v)}
              title={selectedModel ? `Model: ${selectedModel}` : 'Choose AI model'}
              style={{
                width: '38px', height: '38px', borderRadius: '12px',
                border: `1px solid ${selectedModel ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.07)'}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: selectedModel ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                color: selectedModel ? '#a78bfa' : '#6b7280',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#c4b5fd';
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)';
                e.currentTarget.style.background = 'rgba(124,58,237,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = selectedModel ? '#a78bfa' : '#6b7280';
                e.currentTarget.style.borderColor = selectedModel ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.07)';
                e.currentTarget.style.background = selectedModel ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)';
              }}
            >
              <Plus size={16} strokeWidth={2.2} />
            </button>

            {showModelPicker && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
                zIndex: 200, minWidth: '290px',
                background: 'rgba(10,6,22,0.97)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(139,92,246,0.28)',
                borderRadius: '16px', padding: '8px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
              }}>
                {/* Header */}
                <div style={{
                  padding: '6px 10px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: '6px',
                  display: 'flex', alignItems: 'center', gap: '7px',
                }}>
                  <Cpu size={13} color="#7c3aed" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Free-tier models
                  </span>
                </div>

                {/* Model options */}
                {FREE_MODELS.map((m) => {
                  const isActive = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedModel(isActive ? null : m.id); setShowModelPicker(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', padding: '9px 10px', borderRadius: '10px',
                        border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        background: isActive ? 'rgba(124,58,237,0.18)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isActive ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                        <Cpu size={13} color={isActive ? '#a78bfa' : '#6b7280'} />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#e2e8f0' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '1px' }}>
                          {m.rpd.toLocaleString()} req / day free
                        </div>
                      </div>

                      {/* Badge */}
                      {m.badge && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 7px',
                          borderRadius: '20px', flexShrink: 0,
                          color: m.badgeColor, background: `${m.badgeColor}18`,
                          border: `1px solid ${m.badgeColor}40`,
                        }}>
                          {m.badge}
                        </span>
                      )}

                      {/* Checkmark */}
                      {isActive && <Check size={14} color="#a78bfa" style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}

                {/* Reset hint */}
                {selectedModel && (
                  <div style={{
                    marginTop: '6px', padding: '6px 10px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <button
                      type="button"
                      onClick={() => { setSelectedModel(null); setShowModelPicker(false); }}
                      style={{
                        fontSize: '11px', color: '#6b7280', background: 'none',
                        border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                      }}
                    >
                      ↩ Reset to server default
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            style={{
              flexShrink: 0, width: '38px', height: '38px', borderRadius: '12px',
              border: 'none', cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: canSend
                ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
                : 'rgba(255,255,255,0.04)',
              color: canSend ? '#fff' : '#374151',
              boxShadow: canSend ? '0 4px 16px rgba(124,58,237,0.38)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isLoading
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={15} strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main AIChatWindow component ─────────────────────────────────── */
export function AIChatWindow() {
  const { user, getToken } = useAuth();
  const {
    currentConversation, currentId,
    addMessage, updateLastAssistantMessage, updateTitle, createConversation,
  } = useConversations();
  const { documents, loadDocuments } = useDocuments();

  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);
  const cancelRef = useRef(null);

  const messages = currentConversation?.messages ?? [];

  /* Auto-scroll to newest message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content?.length]);

  /* Cancel running stream when conversation changes */
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      setIsLoading(false);
    };
  }, [currentId]);

  /* Cleanup on unmount */
  useEffect(() => () => cancelRef.current?.(), []);

  const handleSend = useCallback(async (text, model = null) => {
    if (!text.trim() || isLoading) return;

    // Cancel any existing stream
    cancelRef.current?.();

    // Resolve (or create) the target conversation
    let convId = currentId;
    if (!convId) convId = createConversation();

    // Build history BEFORE adding new messages
    const history = (currentConversation?.messages ?? [])
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const isFirstMessage =
      (currentConversation?.messages ?? []).filter((m) => m.role !== 'system').length === 0 ||
      currentConversation?.title === 'New chat';

    // If message contains #N refs, refresh docs from server first so we get the
    // latest status (prevents stale 'indexing' state causing fallback to general AI).
    let freshDocs = documents;
    if (/#\d+\b/.test(text)) {
      const fetched = await loadDocuments();
      if (fetched) freshDocs = fetched;
    }

    // Parse hashtag references against the freshest doc list
    const { docIds, notFound, notReady } = parseHashtagRefs(text, freshDocs);

    // Collect warning parts
    const warnings = [];
    if (notFound.length > 0) {
      warnings.push(`Document ID${notFound.length > 1 ? 's' : ''} not found: ${notFound.map((id) => `#${id}`).join(', ')}`);
    }
    if (notReady.length > 0) {
      const label = (d) =>
        d.status === 'error'
          ? `#${d.id} (${d.name}) — processing failed`
          : `#${d.id} (${d.name}) — still processing`;
      warnings.push(`Document${notReady.length > 1 ? 's' : ''} not ready: ${notReady.map(label).join(', ')}`);
    }

    // Add user message
    const uid = genId();
    addMessage(convId, { id: uid, role: 'user', content: text, timestamp: new Date().toISOString() });

    // Add system warning if needed
    if (warnings.length > 0) {
      const wid = genId();
      addMessage(convId, {
        id: wid,
        role: 'system',
        content: `Warning: ${warnings.join('. ')}. ${docIds.length > 0 ? 'Proceeding with available documents.' : 'Falling back to general AI chat.'}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Add empty assistant placeholder
    const aid = genId();
    addMessage(convId, { id: aid, role: 'assistant', content: '', isStreaming: true, timestamp: new Date().toISOString() });
    setIsLoading(true);

    // Fire title generation in background (first message only)
    if (isFirstMessage) {
      const token = getToken();
      generateChatTitle(text, token).then((title) => updateTitle(convId, title));
    }

    // Start SSE stream
    const token = getToken();
    let accumulated = '';

    const onChunk = (chunk) => {
      accumulated += chunk;
      updateLastAssistantMessage(convId, accumulated, true);
    };
    const onDone = () => {
      // Only keep sources if the AI actually cited them with [N] markers.
      // If the response is a fallback/error message it won't have citations,
      // so we explicitly clear any sources that arrived over the stream.
      const hasCitations = /\[\d+\]/.test(accumulated);
      updateLastAssistantMessage(
        convId,
        accumulated || 'I encountered an issue. Please try again.',
        false,
        hasCitations ? undefined : [],
      );
      setIsLoading(false);
      cancelRef.current = null;
    };
    const onError = () => {
      // Always clear sources on error.
      updateLastAssistantMessage(convId, accumulated || 'Something went wrong. Please try again.', false, []);
      setIsLoading(false);
      cancelRef.current = null;
    };

    if (docIds.length > 0) {
      // Doc-grounded chat — capture sources when they arrive
      const onSources = (sources) => {
        updateLastAssistantMessage(convId, accumulated, false, sources);
      };
      cancelRef.current = streamDocChat(text, docIds, history, token, onChunk, onSources, onDone, onError, model);
    } else {
      cancelRef.current = streamAiChat(text, history, token, onChunk, onDone, onError, model);
    }
  }, [
    currentId, currentConversation, isLoading, documents,
    addMessage, updateLastAssistantMessage, updateTitle,
    createConversation, getToken, loadDocuments,
  ]);

  /* Suggestion handler — no hashtag parsing needed for suggestion prompts */
  const handleSuggestion = useCallback((label) => {
    handleSend(label, null);
  }, [handleSend]);

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Messages area ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px', scrollBehavior: 'smooth' }}>
        {messages.length === 0 ? (
          <WelcomeScreen
            userName={user?.fullName || user?.username}
            onSuggestion={handleSuggestion}
          />
        ) : (
          <div style={{ maxWidth: '780px', margin: '0 auto', padding: '28px 0 16px' }}>
            {messages.map((msg) => (
              <Bubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} style={{ height: '1px' }} />
          </div>
        )}
      </div>

      {/* ── Input bar (always visible at bottom) ──────────── */}
      <div style={{
        flexShrink: 0,
        padding: '10px 16px 22px',
        background: 'linear-gradient(to top, rgba(8,5,18,0.97) 70%, transparent)',
      }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <ChatInputBar
            onSend={handleSend}
            isLoading={isLoading}
            documents={documents}
          />
          <p style={{
            textAlign: 'center', fontSize: '11px', color: '#1f2937',
            margin: '8px 0 0', lineHeight: 1.5,
          }}>
            DocAI can make mistakes — verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
