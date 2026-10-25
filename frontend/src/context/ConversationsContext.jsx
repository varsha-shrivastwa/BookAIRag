'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ConversationsContext = createContext(null);

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function storageKey(userId) {
  return `docai_chats_${userId}`;
}

export function ConversationsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setConversations([]);
      setCurrentId(null);
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(user.id));
      const saved = raw ? JSON.parse(raw) : [];
      setConversations(Array.isArray(saved) ? saved : []);
    } catch {
      setConversations([]);
    }
    setCurrentId(null);
    setHydrated(true);
  }, [isAuthenticated, user?.id]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (!hydrated || !user?.id) return;
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(conversations));
    } catch {
      // Storage quota exceeded — ignore silently
    }
  }, [conversations, hydrated, user?.id]);

  const currentConversation = conversations.find((c) => c.id === currentId) ?? null;

  /** Create a brand-new empty conversation, switch to it, and return its id. */
  const createConversation = useCallback(() => {
    const id = genId();
    const now = new Date().toISOString();
    const conv = { id, title: 'New chat', createdAt: now, updatedAt: now, messages: [] };
    setConversations((prev) => [conv, ...prev]);
    setCurrentId(id);
    return id;
  }, []);

  /** Switch the active conversation without creating a new one. */
  const switchConversation = useCallback((id) => {
    setCurrentId(id);
  }, []);

  /** Update the title of a specific conversation. */
  const updateTitle = useCallback((id, title) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: title.slice(0, 80), updatedAt: new Date().toISOString() } : c
      )
    );
  }, []);

  /** Append a message object to a conversation's message list. */
  const addMessage = useCallback((conversationId, message) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: [...c.messages, message],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  /**
   * Update the content (and streaming flag) of the LAST assistant message
   * in a conversation — used while SSE chunks arrive.
   */
  const updateLastAssistantMessage = useCallback((conversationId, content, isStreaming, sources) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        const msgs = [...c.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') {
            msgs[i] = { ...msgs[i], content, isStreaming, ...(sources !== undefined ? { sources } : {}) };
            break;
          }
        }
        return { ...c, messages: msgs, updatedAt: new Date().toISOString() };
      })
    );
  }, []);

  /** Remove a conversation from the list. */
  const deleteConversation = useCallback((id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setCurrentId((prev) => (prev === id ? null : prev));
  }, []);

  /** Wipe all conversations for this user. */
  const clearAll = useCallback(() => {
    setConversations([]);
    setCurrentId(null);
  }, []);

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        currentId,
        currentConversation,
        hydrated,
        createConversation,
        switchConversation,
        updateTitle,
        addMessage,
        updateLastAssistantMessage,
        deleteConversation,
        clearAll,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useConversations must be used within <ConversationsProvider>');
  return ctx;
}
