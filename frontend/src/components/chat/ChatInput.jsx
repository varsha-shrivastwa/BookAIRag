'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

export function ChatInput({ onSendMessage, isLoading }) {
  const [input, setInput]       = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charLimit  = 1000;
  const remaining  = charLimit - input.length;
  const isNearLimit = remaining < 100;
  const canSubmit  = input.trim().length > 0 && !isLoading && input.length <= charLimit;

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ position: 'relative' }}>

        {/* Glow ring behind box */}
        <div style={{
          position: 'absolute', inset: '-1px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
          filter: 'blur(6px)',
          opacity: isFocused ? 0.55 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Input box */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '18px',
          background: 'rgba(10, 12, 25, 0.88)',
          backdropFilter: 'blur(20px)',
          border: `1.5px solid ${isFocused ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isFocused ? '0 0 0 3px rgba(139,92,246,0.12)' : '0 4px 24px rgba(0,0,0,0.3)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}>

          {/* Top accent line on focus */}
          <div style={{
            position: 'absolute', top: 0, left: '24px', right: '24px', height: '1px',
            borderRadius: '9999px',
            background: 'linear-gradient(90deg, transparent, #7c3aed, #6366f1, #ec4899, transparent)',
            opacity: isFocused ? 0.8 : 0,
            transition: 'opacity 0.3s',
          }} />

          {/* Textarea */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isLoading}
              placeholder="Describe the kind of book you're looking for…"
              maxLength={charLimit}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: '#f1f5f9',
                fontSize: '14px',
                lineHeight: '1.6',
                minHeight: '28px',
                maxHeight: '160px',
                fontFamily: 'inherit',
                opacity: isLoading ? 0.5 : 1,
              }}
            />
            {isNearLimit && (
              <span style={{
                fontSize: '11px', fontFamily: 'monospace',
                color: remaining <= 0 ? '#f87171' : 'rgba(234,179,8,0.7)',
              }}>
                {remaining}
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              flexShrink: 0,
              width: '38px', height: '38px',
              borderRadius: '12px',
              border: 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: canSubmit
                ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
                : 'rgba(255,255,255,0.05)',
              color: canSubmit ? '#fff' : '#4b5563',
              boxShadow: canSubmit ? '0 4px 16px rgba(124,58,237,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isLoading
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={15} strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    </form>
  );
}
