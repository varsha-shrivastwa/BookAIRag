'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

export function ChatInput({ onSendMessage, isLoading }) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
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

  const charLimit = 1000;
  const remaining = charLimit - input.length;
  const isNearLimit = remaining < 100;
  const canSubmit = input.trim().length > 0 && !isLoading && input.length <= charLimit;

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative group">
        {/* Animated gradient glow behind the box */}
        <div
          className={`absolute -inset-[1px] rounded-2xl transition-opacity duration-500 ${
            isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
          }`}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1, #ec4899)',
            filter: 'blur(6px)',
            zIndex: 0,
          }}
        />

        {/* Main input box */}
        <div
          className={`relative flex items-end gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
            isFocused
              ? 'border-purple-500/40 shadow-lg shadow-purple-500/20'
              : 'border-white/[0.07] hover:border-purple-500/20'
          }`}
          style={{ zIndex: 1, background: 'rgba(10, 12, 25, 0.85)', backdropFilter: 'blur(20px)' }}
        >
          {/* Top accent line */}
          <div
            className={`absolute top-0 left-6 right-6 h-[1px] rounded-full transition-all duration-500 ${
              isFocused ? 'opacity-80' : 'opacity-0'
            }`}
            style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6, #6366f1, #ec4899, transparent)' }}
          />

          {/* Textarea */}
          <div className="flex-1 min-w-0">
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
              className="w-full bg-transparent text-gray-100 text-sm leading-relaxed resize-none focus:outline-none placeholder:text-gray-500 disabled:opacity-50 min-h-[28px] max-h-[160px] transition-colors duration-200"
            />
            {/* Character counter */}
            {isNearLimit && (
              <span className={`text-[11px] font-mono transition-colors ${remaining <= 0 ? 'text-red-400' : 'text-yellow-500/70'}`}>
                {remaining}
              </span>
            )}
          </div>

          {/* Send button — inline with textarea */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden
              ${canSubmit
                ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:-translate-y-0.5 active:scale-95'
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" strokeWidth={2.2} />
            }
          </button>
        </div>
      </div>
    </form>
  );
}
