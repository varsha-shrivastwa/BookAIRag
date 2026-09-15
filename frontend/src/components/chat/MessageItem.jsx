'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { BookRecommendationGrid } from '../books/BookRecommendationGrid';

export function MessageItem({ message, onBookClick }) {
  const { role, content, recommendedBooks, isStreaming } = message || {};
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex gap-3 py-1 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Bot Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 flex-shrink-0 mt-1 ring-2 ring-purple-500/20">
          <Bot className="w-4 h-4" strokeWidth={2} />
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-tr-sm shadow-xl shadow-purple-500/20 border border-purple-400/20'
              : 'glass-panel text-gray-200 rounded-tl-sm border-white/[0.07]'
          }`}
        >
          <div className="whitespace-pre-wrap message-prose">
            {content}
            {isStreaming && (
              <span className="inline-block w-[2px] h-[14px] bg-purple-400 ml-[2px] align-middle cursor-blink" />
            )}
          </div>

          {/* Book grid (only for assistant) */}
          {!isUser && recommendedBooks && recommendedBooks.length > 0 && (
            <BookRecommendationGrid books={recommendedBooks} onBookClick={onBookClick} />
          )}
        </div>

        {/* Timestamp-style label */}
        <p className={`text-[10px] text-gray-600 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {isUser ? 'You' : 'BookAI'}
        </p>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center text-gray-300 flex-shrink-0 mt-1">
          <User className="w-4 h-4" strokeWidth={2} />
        </div>
      )}
    </motion.div>
  );
}
