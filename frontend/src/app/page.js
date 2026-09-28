'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { BookOpen, LogOut, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, ready, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace('/login');
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) return null;

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Navbar ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}>
        {/* Accent bar */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #7c3aed, #6366f1, #ec4899)' }} />

        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', width: '38px', height: '38px' }}>
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
                filter: 'blur(6px)', opacity: 0.6,
              }} />
              <div style={{
                position: 'relative', width: '38px', height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
              }}>
                <BookOpen size={18} color="#fff" strokeWidth={2.2} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '16px', fontWeight: 800,
                  background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 40%, #ec4899 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>BookAI</span>
                <span style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                  padding: '2px 8px', borderRadius: '9999px',
                  background: 'rgba(139,92,246,0.15)', color: '#c4b5fd',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}>RAG</span>
              </div>
              <p style={{ fontSize: '10px', color: '#6b7280', fontWeight: 500, marginTop: '1px' }}>
                Intelligent Book Companion
              </p>
            </div>
          </div>

          {/* User + Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 12px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={13} color="#fff" />
              </div>
              <span style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 500 }}>
                {user?.fullName || user?.username}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '12px',
                background: 'none', border: '1px solid transparent',
                color: '#9ca3af', cursor: 'pointer', fontSize: '13px',
                transition: 'all 0.2s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#f87171';
                e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Chat Area ── */}
      <div style={{ flex: 1 }}>
        <ChatContainer />
      </div>
    </div>
  );
}
