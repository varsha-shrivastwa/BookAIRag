const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Ask the backend to generate a short title for a conversation.
 * Returns a plain string (never throws).
 */
export async function generateChatTitle(message, token) {
  try {
    const res = await fetch(`${API_BASE}/chat/title`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) return 'New chat';
    const data = await res.json();
    return data.title || 'New chat';
  } catch {
    return 'New chat';
  }
}

/**
 * Open an SSE stream for a document-grounded RAG chat message.
 *
 * @param {string}   message      User's message
 * @param {number[]} documentIds  IDs of indexed documents to query
 * @param {Array}    history      [{role, content}] prior turns
 * @param {string}   token        JWT bearer token
 * @param {Function} onChunk      Called with each text chunk string
 * @param {Function} onSources    Called once with the sources array (may be omitted)
 * @param {Function} onDone       Called when the stream ends normally
 * @param {Function} onError      Called on error with a message string
 * @returns {Function}  abort() — call to cancel the stream
 */
export function streamDocChat(message, documentIds, history, token, onChunk, onSources, onDone, onError, model = null) {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/doc-chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, documentIds, history, ...(model ? { model } : {}) }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        onError?.(`Request failed (${res.status})`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { onDone?.(); return; }
          try {
            const event = JSON.parse(raw);
            if (event.type === 'chunk') onChunk?.(event.content);
            if (event.type === 'sources') onSources?.(event.sources);
            if (event.type === 'error') onError?.(event.message);
          } catch { /* ignore malformed line */ }
        }
      }
      onDone?.();
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err.message);
    }
  })();

  return () => ctrl.abort();
}

/**
 * Open an SSE stream for a general AI chat message.
 *
 * @param {string}   message   User's message
 * @param {Array}    history   [{role, content}] prior turns
 * @param {string}   token     JWT bearer token
 * @param {Function} onChunk   Called with each text chunk
 * @param {Function} onDone    Called when stream ends normally
 * @param {Function} onError   Called on error with a message string
 * @returns {Function}  abort() — call to cancel the stream
 */
export function streamAiChat(message, history, token, onChunk, onDone, onError, model = null) {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/ai-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, history, ...(model ? { model } : {}) }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        onError?.(`Request failed (${res.status})`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line for next chunk

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            onDone?.();
            return;
          }
          try {
            const event = JSON.parse(raw);
            if (event.type === 'chunk') onChunk?.(event.content);
            if (event.type === 'error') onError?.(event.message);
          } catch {
            // Ignore malformed SSE line
          }
        }
      }
      onDone?.();
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err.message);
    }
  })();

  return () => ctrl.abort();
}
