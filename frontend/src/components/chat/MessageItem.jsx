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
      style={{
        display: 'flex',
        gap: '12px',
        padding: '4px 0',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {/* Bot Avatar */}
      {!isUser && (
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
          background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
          border: '2px solid rgba(139,92,246,0.2)',
        }}>
          <Bot size={16} color="#fff" strokeWidth={2} />
        </div>
      )}

      <div style={{ maxWidth: '82%', order: isUser ? 1 : 2 }}>
        {/* Bubble */}
        <div style={isUser ? {
          padding: '12px 16px',
          borderRadius: '18px',
          borderTopRightRadius: '4px',
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
          color: '#fff',
          fontSize: '14px',
          lineHeight: '1.6',
          boxShadow: '0 8px 32px rgba(124,58,237,0.3)',
          border: '1px solid rgba(167,139,250,0.2)',
        } : {
          padding: '12px 16px',
          borderRadius: '18px',
          borderTopLeftRadius: '4px',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          color: '#e2e8f0',
          fontSize: '14px',
          lineHeight: '1.6',
        }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {content}
            {isStreaming && (
              <span style={{
                display: 'inline-block', width: '2px', height: '14px',
                background: '#a78bfa', marginLeft: '2px', verticalAlign: 'middle',
                animation: 'blink 0.9s step-end infinite',
              }} />
            )}
          </div>

          {!isUser && recommendedBooks && recommendedBooks.length > 0 && (
            <BookRecommendationGrid books={recommendedBooks} onBookClick={onBookClick} />
          )}
        </div>

        {/* Label */}
        <p style={{
          fontSize: '10px', color: '#4b5563', marginTop: '4px',
          paddingLeft: '4px', paddingRight: '4px',
          textAlign: isUser ? 'right' : 'left',
        }}>
          {isUser ? 'You' : 'BookAI'}
        </p>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af',
        }}>
          <User size={15} strokeWidth={2} />
        </div>
      )}
    </motion.div>
  );
}
