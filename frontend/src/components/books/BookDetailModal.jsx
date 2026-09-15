'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, BookOpen, User, Tag, ExternalLink, Calendar, Building2, ArrowUpRight } from 'lucide-react';

export function BookDetailModal({ book, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!book) return null;

  const { title, authors, description, categories, thumbnail, infoLink, publisher, publishedDate } = book;
  const authorText = Array.isArray(authors) ? authors.join(', ') : authors || 'Unknown Author';
  const allCategories = (Array.isArray(categories) ? categories : [categories]).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl shadow-black/60"
        style={{ background: 'rgba(10, 10, 22, 0.95)', backdropFilter: 'blur(30px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top gradient stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 rounded-t-2xl" />

        <div className="p-6 pt-7">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header — cover + metadata */}
          <div className="flex gap-5 mb-6 pr-8">
            {/* Cover */}
            <div className="w-32 h-44 rounded-xl overflow-hidden flex-shrink-0 shadow-xl shadow-black/50 ring-1 ring-white/10">
              {thumbnail ? (
                <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-gray-600">
                  <BookOpen className="w-10 h-10 mb-2 text-purple-700" />
                  <span className="text-xs">No Cover</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-xl font-bold text-gray-100 leading-snug mb-2">{title}</h2>

              <div className="flex items-center gap-1.5 mb-3 text-sm text-gray-400">
                <User className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                <span>{authorText}</span>
              </div>

              {/* Categories */}
              {allCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {allCategories.map((cat, i) => (
                    <span key={i} className="badge">
                      <Tag className="w-2.5 h-2.5" />
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Publisher & date */}
              <div className="space-y-1.5">
                {publisher && publisher !== 'Unknown Publisher' && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Building2 className="w-3.5 h-3.5 text-gray-700" />
                    {publisher}
                  </div>
                )}
                {publishedDate && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5 text-gray-700" />
                    {publishedDate}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">About this book</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              {description || 'No detailed description available for this volume.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {infoLink && (
              <a
                href={infoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 active:scale-95"
              >
                View on Google Books
                <ArrowUpRight className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
