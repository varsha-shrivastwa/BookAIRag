'use client';

import React from 'react';

export function GlassCard({ children, className = '', glow = false, ...props }) {
  return (
    <div
      className={`glass-panel rounded-2xl p-6 transition-all duration-300 ${
        glow ? 'glass-glow border-purple-500/30' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
