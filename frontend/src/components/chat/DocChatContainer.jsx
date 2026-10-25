'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { DocSourcesPanel } from './DocSourcesPanel';
import { DocumentSummaryPanel } from './DocumentSummaryPanel';
import { streamDocChat } from '@/services/documentsApi';
import { useDocuments } from '@/context/DocumentsContext';
import { FileText, Sparkles, FolderOpen, BookOpen, MessageSquare, RotateCcw } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'What is this document about?',
  'Summarize the document in simple language',
  'What are the main points discussed?',
  'List all requirements mentioned',
  'What data or statistics are highlighted?',
  'Describe any tables or charts',
  'Find the section that discusses risks',
  'What are the key conclusions?',
];

const MULTI_DOC_QUESTION = 'Compare information across these documents';

function SuggestionChip({ label, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 14px',
        borderRadius: '9999px',
        border: `1px solid ${hovered ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.2)'}`,
        background: hovered ? 'rgba(124,58,237,0.14)' : 'rgba(124,58,237,0.06)',
        color: hovered ? '#ddd6fe' : '#a78bfa',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your Document Assistant. Upload documents in the sidebar, select the ones you want to explore, and ask me anything about their contents.",
};

function DocMessageItem({ message }) {
  const [activeCitation, setActiveCitation] = useState(null);
  const hasSources = message.role === 'assistant' && message.sources?.length > 0;

  return (
    <div>
      <MessageItem
        message={message}
        onBookClick={null}
        onCitationClick={hasSources ? setActiveCitation : undefined}
      />
      {hasSources && (
        <div style={{ paddingLeft: '46px', marginTop: '-8px', paddingBottom: '4px' }}>
          <DocSourcesPanel
            sources={message.sources}
            activeCitation={activeCitation}
            onCitationClick={setActiveCitation}
          />
        </div>
      )}
    </div>
  );
}

export function DocChatContainer() {
  const { selectedIds, documents } = useDocuments();
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Close summary when selection changes
  useEffect(() => {
    if (selectedIds.size === 0) setShowSummary(false);
  }, [selectedIds]);

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  const selectedNames = documents
    .filter((d) => selectedIds.has(d.id) && d.status === 'ready')
    .map((d) => d.name);

  const handleNewConversation = () => {
    setMessages([WELCOME_MESSAGE]);
    setShowSummary(false);
  };

  const handleSend = async (text) => {
    if (!hasSelection) return;
    setShowSummary(false);

    const botMsgIdx = messages.length + 1;
    const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', isStreaming: true, sources: [] },
    ]);
    setIsLoading(true);

    await streamDocChat(
      text,
      [...selectedIds],
      history,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[botMsgIdx]) {
            updated[botMsgIdx] = { ...updated[botMsgIdx], content: updated[botMsgIdx].content + chunk };
          }
          return updated;
        });
      },
      (sources) => {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[botMsgIdx]) {
            updated[botMsgIdx] = { ...updated[botMsgIdx], isStreaming: false, sources };
          }
          return updated;
        });
        setIsLoading(false);
      },
      () => {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[botMsgIdx]) {
            updated[botMsgIdx] = {
              ...updated[botMsgIdx],
              content: "Sorry, I couldn't reach the server. Please try again.",
              isStreaming: false,
              sources: [],
            };
          }
          return updated;
        });
        setIsLoading(false);
      },
    );
  };

  const isWelcomeState = messages.length <= 1 && !showSummary;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', maxWidth: '860px',
      margin: '0 auto', padding: '0 20px',
    }}>

      {/* Welcome hero */}
      <AnimatePresence>
        {isWelcomeState && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5 }}
            style={{ paddingTop: '40px', paddingBottom: '24px', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '20px',
                  background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
                  filter: 'blur(12px)', opacity: 0.6,
                }} />
                <div style={{
                  position: 'relative', width: '80px', height: '80px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 16px 48px rgba(124,58,237,0.45)',
                  animation: 'float 6s ease-in-out infinite',
                }}>
                  <FileText size={36} color="#fff" strokeWidth={1.8} />
                </div>
                <span style={{
                  position: 'absolute', top: '-8px', right: '-8px',
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(251,191,36,0.4)',
                }}>
                  <Sparkles size={13} color="#fff" />
                </span>
              </div>
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', lineHeight: 1.3 }}>
              <span style={{
                background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 40%, #ec4899 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Ask Anything About</span>
              <br />
              <span style={{ color: '#f1f5f9' }}>Your Documents</span>
            </h2>
            <p style={{ color: '#6b7280', fontSize: '14px', maxWidth: '440px', margin: '0 auto', lineHeight: 1.7 }}>
              Upload files in the sidebar, select documents, then ask questions. Answers are grounded in your content.
            </p>

            {/* Suggested questions — only visible when documents are selected */}
            {hasSelection && (
              <div style={{ marginTop: '28px' }}>
                <p style={{ fontSize: '11px', color: '#4b5563', marginBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Try asking
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '580px', margin: '0 auto' }}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <SuggestionChip key={q} label={q} onClick={() => handleSend(q)} />
                  ))}
                  {selectedCount > 1 && (
                    <SuggestionChip label={MULTI_DOC_QUESTION} onClick={() => handleSend(MULTI_DOC_QUESTION)} />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No selection notice */}
      {!hasSelection && !isWelcomeState && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', margin: '8px 0', borderRadius: '10px',
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.15)',
        }}>
          <FolderOpen size={14} color="#a78bfa" />
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            Select documents from the sidebar to enable chat
          </span>
        </div>
      )}

      {/* Active selection bar */}
      {hasSelection && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', margin: '6px 0', borderRadius: '8px',
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.12)',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 500, flexShrink: 0 }}>
            Chatting with:
          </span>
          {selectedNames.slice(0, 3).map((name) => (
            <span key={name} style={{
              fontSize: '10px', color: '#c4b5fd', padding: '2px 8px', borderRadius: '9999px',
              background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)',
              maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={name}>{name}</span>
          ))}
          {selectedNames.length > 3 && (
            <span style={{ fontSize: '10px', color: '#6b7280' }}>+{selectedNames.length - 3} more</span>
          )}

          {/* Controls: New chat + Chat/Summarize toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              onClick={handleNewConversation}
              title="Start a new conversation"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', background: 'transparent', color: '#6b7280',
                marginRight: '4px',
              }}
            >
              <RotateCcw size={10} />
              New chat
            </button>
            <button
              onClick={() => setShowSummary(false)}
              title="Chat mode"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: !showSummary ? 'rgba(124,58,237,0.2)' : 'transparent',
                color: !showSummary ? '#c4b5fd' : '#6b7280',
              }}
            >
              <MessageSquare size={10} />
              Chat
            </button>
            <button
              onClick={() => setShowSummary(true)}
              title="Summarize documents"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: showSummary ? 'rgba(124,58,237,0.2)' : 'transparent',
                color: showSummary ? '#c4b5fd' : '#6b7280',
              }}
            >
              <BookOpen size={10} />
              Summarize
            </button>
          </div>
        </div>
      )}

      {/* Summary panel */}
      {showSummary ? (
        <div style={{ flex: 1, overflow: 'hidden', marginBottom: '12px' }}>
          <DocumentSummaryPanel onClose={() => setShowSummary(false)} />
        </div>
      ) : (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '16px' }}>
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <DocMessageItem key={idx} message={msg} />
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            <AnimatePresence>
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 8px' }}
                >
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
                  }}>
                    <Sparkles size={15} color="#fff" style={{ animation: 'spin 1.5s linear infinite' }} />
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', borderRadius: '16px',
                    background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                  }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>Searching your documents</span>
                    <ThinkingDots />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 0 16px' }}>
            <ChatInput
              onSendMessage={handleSend}
              isLoading={isLoading}
              disabled={!hasSelection}
              placeholder={hasSelection ? 'Ask a question about your documents…' : 'Select documents to start chatting'}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: '5px', height: '5px', borderRadius: '50%', background: '#a78bfa',
          animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </span>
  );
}
