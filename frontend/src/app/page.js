'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User, PanelLeftClose, PanelLeftOpen, Plus, FileText, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConversations } from '@/context/ConversationsContext';
import { useDocuments } from '@/context/DocumentsContext';
import { UnifiedSidebar } from '@/components/layout/UnifiedSidebar';
import { AIChatWindow } from '@/components/chat/AIChatWindow';
import SettingsPanel from '@/components/settings/SettingsPanel';

/** SSR-safe hook that returns the current viewport width (defaults to 1280). */
function useWindowWidth() {
  const [width, setWidth] = useState(1280);
  useEffect(() => {
    setWidth(window.innerWidth);
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

export default function Home() {
  const { user, ready, isAuthenticated, logout } = useAuth();
  const { createConversation, switchConversation } = useConversations();
  const { loadDocuments } = useDocuments();
  const router = useRouter();
  const width = useWindowWidth();

  const isMobile = width < 768;

  // Desktop sidebar: open by default, toggle-able
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mobile sidebar: overlay drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* Redirect unauthenticated users */
  useEffect(() => {
    if (ready && !isAuthenticated) router.replace('/login');
  }, [ready, isAuthenticated, router]);

  /* Load documents when authenticated */
  useEffect(() => {
    if (isAuthenticated) loadDocuments();
  }, [isAuthenticated, loadDocuments]);

  /* Close mobile drawer when viewport widens past mobile breakpoint */
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  /** Start a new conversation and switch to it. */
  const handleNewChat = useCallback(() => {
    const id = createConversation();
    switchConversation(id);
    setDrawerOpen(false);
  }, [createConversation, switchConversation]);

  /** Called by UnifiedSidebar when a chat is created (mobile auto-closes drawer). */
  const handleSidebarNewChat = useCallback((id) => {
    if (id) switchConversation(id);
    setDrawerOpen(false);
  }, [switchConversation]);

  /* Whether the desktop sidebar is rendered at full width */
  const desktopSidebarVisible = !isMobile && sidebarOpen;

  if (!ready || !isAuthenticated) return null;

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ══ Navbar ════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0,
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8, 5, 18, 0.9)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
      }}>
        {/* Gradient accent line at top of navbar */}
        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, #7c3aed, #6366f1, #ec4899)',
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '9px 14px' : '9px 18px',
        }}>

          {/* LEFT: toggle + logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            {/* Sidebar / drawer toggle */}
            <button
              onClick={() => isMobile ? setDrawerOpen((v) => !v) : setSidebarOpen((v) => !v)}
              title={isMobile ? 'Menu' : (sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar')}
              style={{
                width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer', color: '#4b5563',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#c4b5fd';
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                e.currentTarget.style.background = 'rgba(124,58,237,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#4b5563';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              {isMobile ? <Menu size={16} /> : sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            {/* Logo — only show when sidebar is hidden (collapsed or mobile) */}
            {!desktopSidebarVisible && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(124,58,237,0.38)',
                }}>
                  <FileText size={14} color="#fff" strokeWidth={2.2} />
                </div>
                <span style={{
                  fontSize: '15px', fontWeight: 800,
                  background: 'linear-gradient(135deg, #c4b5fd, #818cf8)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  DocAI
                </span>
              </div>
            )}

            {/* New Chat shortcut button (shown when sidebar collapsed on desktop) */}
            {!isMobile && !sidebarOpen && (
              <button
                onClick={handleNewChat}
                title="New Chat"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.28)',
                  background: 'rgba(124,58,237,0.1)',
                  color: '#c4b5fd', cursor: 'pointer',
                  fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(124,58,237,0.2)';
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(124,58,237,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.28)';
                }}
              >
                <Plus size={14} strokeWidth={2.5} />
                New Chat
              </button>
            )}
          </div>

          {/* RIGHT: user info + sign-out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* User pill — desktop only */}
            {!isMobile && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 12px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={12} color="#fff" />
                </div>
                <span style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 500 }}>
                  {user?.fullName || user?.username}
                </span>
              </div>
            )}

            {/* Avatar circle — mobile only */}
            {isMobile && (
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={13} color="#fff" />
              </div>
            )}

            {/* Settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              title="AI Settings"
              style={{
                width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                background: settingsOpen ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: settingsOpen ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer', color: settingsOpen ? '#c4b5fd' : '#4b5563',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#c4b5fd';
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                e.currentTarget.style.background = 'rgba(124,58,237,0.08)';
              }}
              onMouseLeave={(e) => {
                if (!settingsOpen) {
                  e.currentTarget.style.color = '#4b5563';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
              }}
            >
              <Settings size={15} />
            </button>

            {/* Sign-out */}
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: isMobile ? '6px 8px' : '6px 11px', borderRadius: '10px',
                background: 'none', border: '1px solid transparent',
                color: '#4b5563', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f87171';
                e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#4b5563';
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <LogOut size={14} />
              {!isMobile && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </header>

      {/* ══ Body (sidebar + chat) ══════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Mobile: full-height overlay drawer ───────────────── */}
        {isMobile && (
          <>
            {/* Scrim */}
            {drawerOpen && (
              <div
                onClick={() => setDrawerOpen(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 40,
                  background: 'rgba(0,0,0,0.62)',
                  backdropFilter: 'blur(4px)',
                }}
              />
            )}

            {/* Drawer panel */}
            <div style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              zIndex: 45, width: '280px',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.26s ease',
            }}>
              <UnifiedSidebar
                onMobileClose={() => setDrawerOpen(false)}
                onNewChat={handleSidebarNewChat}
              />
            </div>
          </>
        )}

        {/* ── Desktop: inline collapsible sidebar ──────────────── */}
        {!isMobile && (
          <div style={{
            width: sidebarOpen ? '260px' : '0px',
            flexShrink: 0, overflow: 'hidden',
            transition: 'width 0.26s ease',
          }}>
            {/* Keep it rendered (just hidden) so state is preserved */}
            <div style={{ width: '260px', height: '100%' }}>
              <UnifiedSidebar onNewChat={handleSidebarNewChat} />
            </div>
          </div>
        )}

        {/* ── Chat area ────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          minWidth: 0,
        }}>
          <AIChatWindow />
        </div>
      </div>

      {/* ══ Settings panel (slide-in from right) ══════════════════ */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
