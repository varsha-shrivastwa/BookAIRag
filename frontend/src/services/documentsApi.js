const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken() {
  try { return localStorage.getItem('bookai_token') || ''; } catch { return ''; }
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Upload a document file. Returns { documentId, name, sizeBytes, status }.
 * onUploadProgress(percent) is called with 0–100 during XHR upload.
 */
export function uploadDocument(file, onUploadProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/documents/upload`);

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onUploadProgress) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid server response')); }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout = 5 * 60 * 1000; // 5 minutes for large files

    xhr.send(formData);
  });
}

/**
 * Stream document processing progress via SSE (fetch-based).
 * Calls onStage(stage, message) for each progress update.
 * Calls onDone(documentData) when ready.
 * Calls onError(errorMessage) on failure.
 * Returns an AbortController so the caller can cancel.
 */
export function streamUploadProgress(documentId, onStage, onDone, onError) {
  const token = getToken();
  const url = `${API_BASE_URL}/documents/upload/progress/${documentId}?token=${encodeURIComponent(token)}`;

  let aborted = false;
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) { onError?.('Progress stream unavailable'); return; }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;

          try {
            const event = JSON.parse(data);
            if (event.type === 'progress') {
              // Forward all numeric progress fields so the UI can show granular labels
              // for both the extracting stage (extractedPages/totalPages) and the
              // indexing stage (indexedChunks/totalChunks).
              const progressData = event.progress != null
                ? {
                    percent:        event.progress,
                    // indexing fields
                    indexedChunks:  event.indexedChunks,
                    totalChunks:    event.totalChunks,
                    // extraction fields
                    extractedPages: event.extractedPages,
                    totalPages:     event.totalPages,
                  }
                : null;
              onStage?.(event.stage, event.message, progressData);
            } else if (event.type === 'done') {
              onDone?.(event);
              return;
            } else if (event.type === 'error') {
              onError?.(event.error || 'Processing failed');
              return;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if (!aborted && err.name !== 'AbortError') {
        onError?.(err.message);
      }
    }
  })();

  return { abort: () => { aborted = true; controller.abort(); } };
}

/**
 * List documents for the authenticated user.
 */
export async function getDocuments() {
  const res = await fetch(`${API_BASE_URL}/documents`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

/**
 * Delete a document.
 */
export async function deleteDocument(id) {
  const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

/**
 * Retry processing a failed document.
 */
export async function retryDocument(id) {
  const res = await fetch(`${API_BASE_URL}/documents/${id}/retry`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    let msg = `Retry failed (${res.status})`;
    try { msg = (await res.json())?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Get section headings for a document.
 */
export async function getDocumentSections(id) {
  const res = await fetch(`${API_BASE_URL}/documents/${id}/sections`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch document sections');
  return res.json();
}

/**
 * Stream a full or section summary.
 * type: 'full' | 'section'
 * section: { documentId, heading } (required when type === 'section')
 * Calls onChunk(text), onDone(), onError(err).
 */
export async function streamSummary(documentIds, type, section, onChunk, onDone, onError) {
  try {
    const response = await fetch(`${API_BASE_URL}/doc-chat/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ documentIds, type, section: section || null }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') { onDone?.(); return; }

        try {
          const event = JSON.parse(data);
          if (event.type === 'chunk') onChunk?.(event.content);
          else if (event.type === 'error') throw new Error(event.message);
        } catch (parseErr) { /* ignore */ }
      }
    }
    onDone?.();
  } catch (err) {
    console.error('Summary stream error:', err);
    onError?.(err);
  }
}

/**
 * Stream an AI answer over selected documents.
 * Calls onChunk(text), onSources(sources[]), onError(err).
 */
export async function streamDocChat(message, documentIds, history = [], onChunk, onSources, onError) {
  try {
    const response = await fetch(`${API_BASE_URL}/doc-chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ message, documentIds, history }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const event = JSON.parse(data);
          if (event.type === 'chunk') onChunk?.(event.content);
          else if (event.type === 'sources') onSources?.(event.sources);
          else if (event.type === 'error') throw new Error(event.message);
        } catch (parseErr) { /* ignore */ }
      }
    }
  } catch (err) {
    console.error('Doc chat stream error:', err);
    onError?.(err);
  }
}
