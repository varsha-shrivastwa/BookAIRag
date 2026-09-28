const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getAuthHeaders() {
  try {
    const token = localStorage.getItem('bookai_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Send a chat message and receive a full (non-streaming) JSON response.
 */
export async function sendChatMessage(message, history = [], limit = 5) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ message, history, limit }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return _mockFallback(message);
  }
}

/**
 * Stream a chat message response token-by-token via SSE (text/event-stream).
 */
export async function streamChatMessage(message, history = [], limit = 5, onChunk, onBooks, onError) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ message, history, limit }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

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
          if (event.type === 'chunk' && typeof event.content === 'string') {
            onChunk?.(event.content);
          } else if (event.type === 'books' && Array.isArray(event.books)) {
            onBooks?.(event.books);
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Stream error from server');
          }
        } catch (parseErr) {
          // Ignore malformed SSE lines
        }
      }
    }
  } catch (error) {
    console.error('Streaming API Error:', error);
    onChunk?.(`I couldn't reach the recommendation server for "${message}". Here are some hand-picked suggestions in the meantime:\n`);
    onBooks?.(_mockBooks());
    onError?.(error);
  }
}

// ---------------------------------------------------------------------------
// Mock data — used when the backend is unreachable
// ---------------------------------------------------------------------------

function _mockFallback(message) {
  return {
    reply: `I couldn't reach the recommendation server for "${message}". Here are some hand-picked suggestions in the meantime:`,
    recommendedBooks: _mockBooks(),
  };
}

function _mockBooks() {
  return [
    {
      id: 'mock-1',
      title: 'Project Hail Mary',
      authors: ['Andy Weir'],
      description:
        'A lone astronaut wakes up millions of miles from Earth with no memory and a desperate mission: save the planet from an extinction-level solar event. A masterwork of hard sci-fi problem-solving and heartfelt alien friendship.',
      categories: ['Science Fiction'],
      thumbnail: 'https://covers.openlibrary.org/b/id/12632989-M.jpg',
      infoLink: 'https://books.google.com/books?id=project-hail-mary',
      publisher: 'Ballantine Books',
      publishedDate: '2021',
    },
    {
      id: 'mock-2',
      title: 'Atomic Habits',
      authors: ['James Clear'],
      description:
        'An easy and proven way to build good habits and break bad ones. Clear distills the most fundamental insights from biology, psychology, and neuroscience to create an easy-to-understand guide for making good habits inevitable and bad habits impossible.',
      categories: ['Self-Help', 'Psychology'],
      thumbnail: 'https://covers.openlibrary.org/b/id/10919656-M.jpg',
      infoLink: 'https://books.google.com/books?id=atomic-habits',
      publisher: 'Avery',
      publishedDate: '2018',
    },
    {
      id: 'mock-3',
      title: 'Dune',
      authors: ['Frank Herbert'],
      description:
        'Set in the distant future amidst a feudal interstellar society, Dune tells the story of young Paul Atreides as his family assumes stewardship of the desert planet Arrakis.',
      categories: ['Science Fiction', 'Epic Fantasy'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8691232-M.jpg',
      infoLink: 'https://books.google.com/books?id=dune',
      publisher: 'Chilton Books',
      publishedDate: '1965',
    },
  ];
}
