'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BookCard } from './BookCard';
import { Sparkles } from 'lucide-react';

export function BookRecommendationGrid({ books = [], onBookClick }) {
  if (!books || books.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-purple-400" />
        </div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-purple-300/80">
          Recommended Books
        </h4>
        <span className="ml-auto text-[10px] text-gray-600 font-mono">{books.length} found</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {books.map((book, idx) => (
          <motion.div
            key={book.id || idx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07, duration: 0.35 }}
          >
            <BookCard book={book} onClick={() => onBookClick?.(book)} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
