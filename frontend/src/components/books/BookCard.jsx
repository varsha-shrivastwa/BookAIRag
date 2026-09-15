'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, BookOpen, User, Tag, ArrowUpRight } from 'lucide-react';

export function BookCard({ book, onClick }) {
  const { title, authors, description, categories, thumbnail, infoLink } = book || {};
  const authorText = Array.isArray(authors) ? authors.join(', ') : authors || 'Unknown Author';
  const category = Array.isArray(categories) ? categories[0] : categories || 'General';

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick}
      className="relative group cursor-pointer rounded-2xl overflow-hidden"
    >
      {/* Gradient border ring on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/60 via-indigo-500/40 to-pink-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Card body */}
      <div className="relative m-[1px] rounded-[15px] glass-panel flex flex-col h-full p-4 transition-all duration-300 group-hover:bg-[rgba(20,16,40,0.9)]">

        {/* Category badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="badge truncate max-w-[70%]">
            <Tag className="w-2.5 h-2.5 flex-shrink-0" />
            {category}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0" />
        </div>

        {/* Book cover + meta */}
        <div className="flex gap-3 mb-3">
          <div className="w-16 h-22 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900 shadow-md group-hover:shadow-purple-900/50 transition-shadow">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-16 h-[88px] flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-gray-600">
                <BookOpen className="w-5 h-5 mb-1 text-purple-700" />
                <span className="text-[9px] text-center px-1">No Cover</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-snug group-hover:text-purple-200 transition-colors mb-1">
              {title}
            </h3>
            <p className="text-[11px] text-gray-500 flex items-start gap-1 truncate">
              <User className="w-3 h-3 text-purple-600 flex-shrink-0 mt-0.5" />
              <span className="truncate">{authorText}</span>
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed flex-1 mb-3">
          {description || 'No description available.'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.05]">
          <span className="text-[10px] text-gray-600 group-hover:text-purple-400 transition-colors">
            Click for details
          </span>
          {infoLink && (
            <a
              href={infoLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-500 hover:text-purple-300 transition-colors"
            >
              Google Books
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
