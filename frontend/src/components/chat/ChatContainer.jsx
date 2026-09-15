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
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (text) => {
    const currentLength = messages.length;
    const botMsgIdx = currentLength + 1;

    const history = messages
      .slice(1)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', isStreaming: true, recommendedBooks: [] },
    ]);
    setIsLoading(true);

    await streamChatMessage(
      text,
      history,
      5,
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
      <div className="flex flex-col h-[calc(100vh-57px)] max-w-5xl mx-auto px-4">

        {/* ── Welcome Hero (shown only before first message) ── */}
        <AnimatePresence>
          {isWelcomeState && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              transition={{ duration: 0.5 }}
              className="pt-10 pb-6 text-center"
            >
              {/* Floating icon */}
              <div className="flex justify-center mb-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/40 animate-float">
                    <BookOpen className="w-9 h-9 text-white" strokeWidth={1.8} />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </span>
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-2">
                <span className="gradient-text">Discover Your Next</span>
                <br />
                <span className="text-gray-100">Favourite Book</span>
              </h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed mb-6">
                Powered by RAG — I search Google Books, generate embeddings, and use AI to give you hyper-personalised recommendations.
              </p>

            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Messages scroll area ── */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 pb-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <MessageItem key={idx} message={msg} onBookClick={setSelectedBook} />
            ))}
          </AnimatePresence>

          {/* Thinking indicator — only while waiting for first token */}
          <AnimatePresence>
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 pl-2 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className="glass-panel rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Searching catalog & generating embeddings</span>
                  <ThinkingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* ── Suggested prompt chips ── */}
        <AnimatePresence>
          {messages.length <= 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="pb-3"
            >
              <p className="text-[11px] text-gray-500 font-medium mb-2 pl-1">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.06 }}
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isLoading}
                    className="text-xs glass-panel hover:border-purple-500/40 hover:bg-purple-500/10 text-gray-400 hover:text-purple-300 px-3 py-1.5 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.07]"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input ── */}
        <div className="py-4">
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
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-purple-400"
          style={{ animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
    </span>
  );
}
