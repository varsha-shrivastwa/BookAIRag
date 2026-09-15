'use client';

import React from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { BookOpen } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Top Navigation Bar ── */}
      <header className="glass-panel sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 animate-pulse-glow" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <BookOpen className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <span className="gradient-text text-base">BookAI</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/25 tracking-wide">
                  RAG
                </span>
              </h1>
              <p className="text-[10px] text-gray-500 font-medium">Intelligent Book Companion</p>
            </div>
          </div>

        </div>
      </header>

      {/* ── Main Chat Area ── */}
      <div className="flex-1">
        <ChatContainer />
      </div>
    </div>
  );
}
