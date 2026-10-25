'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { getDocuments, deleteDocument } from '@/services/documentsApi';

const DocumentsContext = createContext(null);

export function DocumentsProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
      // Auto-select already-ready documents if nothing is selected
      setSelectedIds((prev) => {
        if (prev.size > 0) return prev;
        const readyIds = docs.filter((d) => d.status === 'ready').map((d) => d.id);
        return readyIds.length > 0 ? new Set(readyIds) : prev;
      });
      return docs;
    } catch (err) {
      console.error('Failed to load documents:', err);
      return null;
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  const addDocument = useCallback((doc) => {
    setDocuments((prev) => [doc, ...prev]);
  }, []);

  const updateDocument = useCallback((id, patch) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );
  }, []);

  const removeDocument = useCallback(async (id) => {
    await deleteDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleSelection = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const readyIds = documents.filter((d) => d.status === 'ready').map((d) => d.id);
    setSelectedIds(new Set(readyIds));
  }, [documents]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);

  return (
    <DocumentsContext.Provider
      value={{
        documents,
        isLoadingDocuments,
        selectedIds,
        loadDocuments,
        addDocument,
        updateDocument,
        removeDocument,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelected,
      }}
    >
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentsProvider');
  return ctx;
}
