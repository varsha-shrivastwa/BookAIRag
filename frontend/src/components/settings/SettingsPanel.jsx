'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Check, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { getAiSettings, updateAiSettings } from '@/services/settingsApi';

/* ── Tiny helpers ────────────────────────────────────────────────────── */

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '8px 11px', borderRadius: '9px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#e5e7eb', fontSize: '13px', fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.55)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            appearance: 'none', width: '100%', boxSizing: 'border-box',
            padding: '8px 32px 8px 11px', borderRadius: '9px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e5e7eb', fontSize: '13px', fontFamily: 'inherit',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#1a1025' }}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={13} color="#6b7280" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
    </label>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────── */

export default function SettingsPanel({ onClose }) {
  const [tab, setTab] = useState('gemini');          // 'gemini' | 'ollama' | 'claude'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);        // null | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('');

  // Mirror of backend settings
  const [activeProvider, setActiveProvider] = useState('gemini');
  const [gemini, setGemini] = useState({
    apiKey: '',
    llmModel: 'gemini-2.0-flash',
    embeddingModel: 'gemini-embedding-001',
    embeddingDimension: 768,
    visionModel: 'gemini-2.0-flash',
  });
  const [ollama, setOllama] = useState({
    baseUrl: 'http://localhost:11434',
    llmModel: 'llama3.2',
    embeddingModel: 'nomic-embed-text',
    visionModel: 'llava',
    embeddingDimension: 768,
  });
  const [claude, setClaude] = useState({
    apiKey: '',
    llmModel: 'claude-sonnet-4-6',
    visionModel: 'claude-sonnet-4-6',
    embeddingApiKey: '',
    embeddingModel: 'gemini-embedding-001',
    embeddingDimension: 768,
  });

  // Load current settings on mount
  useEffect(() => {
    getAiSettings()
      .then((data) => {
        setActiveProvider(data.provider);
        setTab(data.provider);
        if (data.gemini) setGemini((prev) => ({ ...prev, ...data.gemini }));
        if (data.ollama) setOllama((prev) => ({ ...prev, ...data.ollama }));
        if (data.claude) setClaude((prev) => ({ ...prev, ...data.claude }));
      })
      .catch(() => {
        setStatus('error');
        setStatusMsg('Could not load settings from server.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleApply = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const data = await updateAiSettings({
        provider: tab,
        gemini,
        ollama,
        claude,
      });
      setActiveProvider(data.provider);
      if (data.gemini) setGemini((prev) => ({ ...prev, ...data.gemini }));
      if (data.ollama) setOllama((prev) => ({ ...prev, ...data.ollama }));
      if (data.claude) setClaude((prev) => ({ ...prev, ...data.claude }));
      setStatus('ok');
      const providerLabel = { gemini: 'Gemini', ollama: 'Ollama', claude: 'Claude' }[tab] || tab;
      setStatusMsg(`Switched to ${providerLabel} successfully.`);
    } catch (err) {
      setStatus('error');
      setStatusMsg(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }, [tab, gemini, ollama, claude]);

  /* Embedding dimension warning: show when the tab's dimension differs from any other provider */
  const currentDim = tab === 'gemini' ? gemini.embeddingDimension
    : tab === 'ollama' ? ollama.embeddingDimension
    : claude.embeddingDimension;
  const otherDims = [
    tab !== 'gemini' && gemini.embeddingDimension,
    tab !== 'ollama' && ollama.embeddingDimension,
    tab !== 'claude' && claude.embeddingDimension,
  ].filter(Boolean);
  const dimMismatch = otherDims.some((d) => d !== currentDim);

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        zIndex: 61, width: '360px',
        background: '#0f0a1e',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '-16px 0 64px rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          flexShrink: 0,
          padding: '16px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#e5e7eb' }}>AI Settings</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
              Active provider:{' '}
              <span style={{
                color: activeProvider === 'gemini' ? '#a78bfa' : activeProvider === 'claude' ? '#f97316' : '#34d399',
                fontWeight: 600,
              }}>
                {{ gemini: 'Gemini', ollama: 'Ollama', claude: 'Claude' }[activeProvider] || activeProvider}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', color: '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '0 18px',
        }}>
          {[
            { id: 'gemini', label: 'Gemini' },
            { id: 'ollama', label: 'Ollama' },
            { id: 'claude', label: 'Claude' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '11px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                color: tab === t.id ? '#c4b5fd' : '#4b5563',
                borderBottom: `2px solid ${tab === t.id ? '#7c3aed' : 'transparent'}`,
                marginBottom: '-1px',
                transition: 'all 0.18s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px' }}>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              Loading settings…
            </div>
          ) : tab === 'gemini' ? (
            <>
              <Field
                label="API Key"
                type="password"
                value={gemini.apiKey}
                onChange={(v) => setGemini((p) => ({ ...p, apiKey: v }))}
                placeholder="AIza…"
              />
              <Field
                label="LLM Model"
                value={gemini.llmModel}
                onChange={(v) => setGemini((p) => ({ ...p, llmModel: v }))}
                placeholder="gemini-2.0-flash"
              />
              <Field
                label="Embedding Model"
                value={gemini.embeddingModel}
                onChange={(v) => setGemini((p) => ({ ...p, embeddingModel: v }))}
                placeholder="gemini-embedding-001"
              />
              <Field
                label="Embedding Dimension"
                type="number"
                value={String(gemini.embeddingDimension)}
                onChange={(v) => setGemini((p) => ({ ...p, embeddingDimension: parseInt(v, 10) || 768 }))}
                placeholder="768"
              />
              <Field
                label="Vision Model"
                value={gemini.visionModel}
                onChange={(v) => setGemini((p) => ({ ...p, visionModel: v }))}
                placeholder="gemini-2.0-flash"
              />
            </>
          ) : tab === 'ollama' ? (
            <>
              <Field
                label="Ollama Base URL"
                value={ollama.baseUrl}
                onChange={(v) => setOllama((p) => ({ ...p, baseUrl: v }))}
                placeholder="http://localhost:11434"
              />
              <Field
                label="LLM Model"
                value={ollama.llmModel}
                onChange={(v) => setOllama((p) => ({ ...p, llmModel: v }))}
                placeholder="llama3.2"
              />
              <Field
                label="Embedding Model"
                value={ollama.embeddingModel}
                onChange={(v) => setOllama((p) => ({ ...p, embeddingModel: v }))}
                placeholder="nomic-embed-text"
              />
              <Field
                label="Embedding Dimension"
                type="number"
                value={String(ollama.embeddingDimension)}
                onChange={(v) => setOllama((p) => ({ ...p, embeddingDimension: parseInt(v, 10) || 768 }))}
                placeholder="768"
              />
              <Field
                label="Vision Model"
                value={ollama.visionModel}
                onChange={(v) => setOllama((p) => ({ ...p, visionModel: v }))}
                placeholder="llava"
              />
            </>
          ) : (
            <>
              <Field
                label="API Key"
                type="password"
                value={claude.apiKey}
                onChange={(v) => setClaude((p) => ({ ...p, apiKey: v }))}
                placeholder="sk-ant-…"
              />
              <Field
                label="LLM Model"
                value={claude.llmModel}
                onChange={(v) => setClaude((p) => ({ ...p, llmModel: v }))}
                placeholder="claude-sonnet-4-6"
              />
              <Field
                label="Vision Model"
                value={claude.visionModel}
                onChange={(v) => setClaude((p) => ({ ...p, visionModel: v }))}
                placeholder="claude-sonnet-4-6"
              />
              <div style={{
                padding: '10px 12px', borderRadius: '9px',
                background: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.2)',
                fontSize: '12px', color: '#fdba74', lineHeight: 1.5,
              }}>
                Claude has no embedding API. Provide a Gemini API key below to handle document embeddings.
              </div>
              <Field
                label="Embedding API Key (Gemini)"
                type="password"
                value={claude.embeddingApiKey}
                onChange={(v) => setClaude((p) => ({ ...p, embeddingApiKey: v }))}
                placeholder="AIza… (for document search)"
              />
              <Field
                label="Embedding Model"
                value={claude.embeddingModel}
                onChange={(v) => setClaude((p) => ({ ...p, embeddingModel: v }))}
                placeholder="gemini-embedding-001"
              />
              <Field
                label="Embedding Dimension"
                type="number"
                value={String(claude.embeddingDimension)}
                onChange={(v) => setClaude((p) => ({ ...p, embeddingDimension: parseInt(v, 10) || 768 }))}
                placeholder="768"
              />
            </>
          )}

          {/* Embedding dimension mismatch warning */}
          {dimMismatch && (
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: '9px',
              background: 'rgba(251,191,36,0.07)',
              border: '1px solid rgba(251,191,36,0.22)',
            }}>
              <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ margin: 0, fontSize: '12px', color: '#fcd34d', lineHeight: 1.5 }}>
                This provider uses a different embedding dimension ({currentDim}) than others.
                Switching will break existing vector searches — re-upload documents after switching.
              </p>
            </div>
          )}

          {/* Ollama info note */}
          {tab === 'ollama' && !loading && (
            <div style={{
              padding: '10px 12px', borderRadius: '9px',
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.15)',
              fontSize: '12px', color: '#6ee7b7', lineHeight: 1.5,
            }}>
              Make sure Ollama is running locally and the models listed above are pulled
              (e.g. <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>ollama pull llama3.2</code>).
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0,
          padding: '14px 18px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {/* Status message */}
          {status && (
            <div style={{
              display: 'flex', gap: '7px', alignItems: 'center',
              padding: '8px 11px', borderRadius: '8px',
              background: status === 'ok' ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${status === 'ok' ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {status === 'ok'
                ? <Check size={13} color="#34d399" />
                : <AlertTriangle size={13} color="#f87171" />}
              <span style={{ fontSize: '12.5px', color: status === 'ok' ? '#6ee7b7' : '#fca5a5' }}>
                {statusMsg}
              </span>
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={saving || loading}
            style={{
              width: '100%', padding: '10px',
              borderRadius: '10px', border: 'none',
              background: saving || loading ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: '#fff', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700,
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              transition: 'opacity 0.18s',
            }}
          >
            {saving
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Applying…</>
              : `Apply & Switch to ${{ gemini: 'Gemini', ollama: 'Ollama', claude: 'Claude' }[tab] || tab}`}
          </button>
        </div>

        {/* Spinner keyframe (inject once) */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}
