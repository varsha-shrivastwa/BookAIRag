'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { streamChatMessage } from '@/services/api';
import { SUGGESTED_PROMPTS } from '@/constants/prompts';
import { BookDetailModal } from '@/components/books/BookDetailModal';
import { BookOpen, Sparkles } from 'lucide-react';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi there! I'm your AI-powered Book Companion. Tell me what kind of book you're in the mood for — a genre, a feeling, a theme, or even a vague idea — and I'll find the perfect match for you.",
};

export function ChatContainer() {
  const [messages, setMessages]     = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading]   = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (text) => {
    const currentLength = messages.length;
    const botMsgIdx = currentLength + 1;

    const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', isStreaming: true, recommendedBooks: [] },
    ]);
    setIsLoading(true);

    await streamChatMessage(
      text, history, 5,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[botMsgIdx]) {
            updated[botMsgIdx] = { ...updated[botMsgIdx], content: updated[botMsgIdx].content + chunk };
          }
          return updated;
        });
      },
      (books) => {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[botMsgIdx]) {
            updated[botMsgIdx] = { ...updated[botMsgIdx], isStreaming: false, recommendedBooks: books };
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
              role: 'assistant',
              content: 'Sorry, I ran into an issue connecting to the recommendation server. Please try again.',
              isStreaming: false,
              recommendedBooks: [],
            };
          }
          return updated;
        });
        setIsLoading(false);
      },
    );
  };

  const isWelcomeState = messages.length <= 1;

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 62px)',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '0 16px',
      }}>

        {/* ── Welcome Hero ── */}
        <AnimatePresence>
          {isWelcomeState && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              transition={{ duration: 0.5 }}
              style={{ paddingTop: '40px', paddingBottom: '24px', textAlign: 'center' }}
            >
              {/* Floating icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
                    filter: 'blur(12px)', opacity: 0.6,
                  }} />
                  <div style={{
                    position: 'relative',
                    width: '80px', height: '80px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 16px 48px rgba(124,58,237,0.45)',
                    animation: 'float 6s ease-in-out infinite',
                  }}>
                    <BookOpen size={36} color="#fff" strokeWidth={1.8} />
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
                }}>Discover Your Next</span>
                <br />
                <span style={{ color: '#f1f5f9' }}>Favourite Book</span>
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px', maxWidth: '440px', margin: '0 auto', lineHeight: 1.7 }}>
                Powered by RAG — I search Google Books, generate embeddings, and use AI to give you hyper-personalised recommendations.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', paddingBottom: '16px' }}>
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <MessageItem key={idx} message={msg} onBookClick={setSelectedBook} />
            ))}
          </AnimatePresence>

          {/* Thinking indicator */}
          <AnimatePresence>
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
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
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>Searching catalog & generating embeddings</span>
                  <ThinkingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* ── Suggested prompts ── */}
        <AnimatePresence>
          {messages.length <= 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              style={{ paddingBottom: '12px' }}
            >
              <p style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: '8px', paddingLeft: '4px' }}>
                Try asking:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.06 }}
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isLoading}
                    style={{
                      fontSize: '12px',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#9ca3af',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.4 : 1,
                      backdropFilter: 'blur(12px)',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                      if (!isLoading) {
                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)';
                        e.currentTarget.style.color = '#c4b5fd';
                        e.currentTarget.style.background = 'rgba(139,92,246,0.1)';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.color = '#9ca3af';
                      e.currentTarget.style.background = 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)';
                    }}
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input ── */}
        <div style={{ padding: '12px 0 16px' }}>
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>

      {/* ── Book detail modal ── */}
      <AnimatePresence>
        {selectedBook && (
          <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#a78bfa',
            animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  );
}
