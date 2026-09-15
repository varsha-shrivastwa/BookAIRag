'use client';

import React from 'react';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'relative px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:pointer-events-none overflow-hidden';

  const variants = {
    primary: [
      'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700',
      'hover:from-purple-500 hover:via-indigo-500 hover:to-purple-600',
      'text-white shadow-lg shadow-purple-500/30',
      'border border-purple-400/20',
      'hover:shadow-purple-500/50 hover:shadow-xl hover:-translate-y-0.5',
    ].join(' '),

    secondary: [
      'bg-white/5 hover:bg-white/10',
      'text-gray-200 border border-white/10 hover:border-white/20',
      'hover:-translate-y-0.5',
    ].join(' '),

    ghost: 'bg-transparent hover:bg-white/5 text-gray-400 hover:text-white',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {/* Shimmer overlay on primary */}
      {variant === 'primary' && (
        <span
          className="absolute inset-0 shimmer opacity-0 hover:opacity-100 transition-opacity duration-300"
          aria-hidden
        />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
