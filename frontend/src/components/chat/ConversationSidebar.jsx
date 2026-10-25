'use client';

import React, { useState, useCallback } from 'react';
import { Plus, MessageSquare, Trash2, FileText, X, Bot } from 'lucide-react';
import { useConversations } from '@/context/ConversationsContext';

/** Group conversations into human-readable date buckets. */
function getBucket(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86_400_000);
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

export function ConversationSidebar({ onMobileClose, onNewChat }) {
  const {
    conversations, currentId,
    switchConversation, deleteConversation, createConversation,
  } = useConversations();

  const [hoveredId, setHoveredId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const handleNew = useCallback(() => {
    const id = createConversation();
    onMobileClose?.();
    onNewChat?.(id);
  }, [createConversation, onMobileClose, onNewChat]);

  const handleSelect = useCallback((id) => {
    switchConversation(id);
    onMobileClose?.();
  }, [switchConversation, onMobileClose]);

  const handleDelete = useCallback((e, id) => {
    e.stopPropagation();
    if (confirmId === id) {
      deleteConversation(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      // Auto-dismiss confirm state after 3 s
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 3000);
    }
  }, [confirmId, deleteConversation]);

  const { buckets, order } = groupConversations(conversations);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'linear-gradient(180deg, #0a0616 0%, #080512 100%)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ padding: '18px 14px 12px', flexShrink: 0 }}>

        {/* Logo row */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '16px',
        }}>
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

          {/* Mobile close button */}
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

        {/* New Chat button */}
        <button
          onClick={handleNew}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 13px', borderRadius: '12px',
            border: '1px solid rgba(139,92,246,0.3)',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.12))',
            color: '#c4b5fd', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(124,58,237,0.1)',
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
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', flexShrink: 0, margin: '0 14px' }} />

      {/* ── Conversation list ─────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 20px' }}>
        {conversations.length === 0 ? (
          <div style={{
            padding: '40px 16px', textAlign: 'center',
            color: '#374151', fontSize: '12.5px', lineHeight: '1.7',
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '16px', margin: '0 auto 14px',
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(139,92,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={22} style={{ color: '#374151' }} />
            </div>
            No chats yet.<br />
            Click <strong style={{ color: '#6b7280' }}>New Chat</strong> to begin.
          </div>
        ) : (
          order.map((label) => (
            <div key={label} style={{ marginBottom: '6px' }}>
              {/* Group label */}
              <div style={{
                padding: '8px 8px 4px',
                fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.09em', textTransform: 'uppercase',
                color: '#2d2d3a',
              }}>
                {label}
              </div>

              {buckets[label].map((conv) => {
                const isActive = conv.id === currentId;
                const isHovered = hoveredId === conv.id;
                const isConfirm = confirmId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelect(conv.id)}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => { setHoveredId(null); }}
                    style={{
                      position: 'relative',
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '9px 10px', marginBottom: '2px',
                      borderRadius: '10px', cursor: 'pointer',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.15))'
                        : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
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
                      paddingRight: isHovered ? '26px' : 0,
                      transition: 'padding 0.15s, color 0.15s',
                    }}>
                      {conv.title}
                    </span>

                    {/* Delete button */}
                    {isHovered && (
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        title={isConfirm ? 'Click again to confirm delete' : 'Delete chat'}
                        style={{
                          position: 'absolute', right: '8px',
                          width: '22px', height: '22px', borderRadius: '6px',
                          border: 'none', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isConfirm ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)',
                          color: isConfirm ? '#f87171' : '#4b5563',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isConfirm) e.currentTarget.style.color = '#9ca3af';
                        }}
                        onMouseLeave={(e) => {
                          if (!isConfirm) e.currentTarget.style.color = '#4b5563';
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

      {/* ── Footer ────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '12px 14px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ fontSize: '10px', color: '#1f2937', textAlign: 'center', lineHeight: 1.5 }}>
          Powered by Google Gemini AI
        </div>
      </div>
    </div>
  );
}
