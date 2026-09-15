const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Send a chat message and receive a full (non-streaming) JSON response.
 * @param {string} message   Current user message
 * @param {Array}  history   Prior conversation turns [{role, content}]
 * @param {number} limit     Number of book recommendations to request
 */
export async function sendChatMessage(message, history = [], limit = 5) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
 *
 * @param {string}   message    Current user message
 * @param {Array}    history    Prior conversation turns [{role, content}]
 * @param {number}   limit      Number of book recommendations to request
 * @param {Function} onChunk    Called with each incremental text token: (content: string) => void
 * @param {Function} onBooks    Called once with the final book list: (books: array) => void
 * @param {Function} onError    Called if the stream fails: (error: Error) => void
 */
export async function streamChatMessage(message, history = [], limit = 5, onChunk, onBooks, onError) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

      // Split buffer on newlines; keep the last incomplete line in the buffer
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
    // Fall back to mock data so the UI stays functional
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
        'Set in the distant future amidst a feudal interstellar society, Dune tells the story of young Paul Atreides as his family assumes stewardship of the desert planet Arrakis — the only source of the most valuable substance in the universe. A sweeping saga of politics, religion, ecology, and power.',
      categories: ['Science Fiction', 'Epic Fantasy'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8691232-M.jpg',
      infoLink: 'https://books.google.com/books?id=dune',
      publisher: 'Chilton Books',
      publishedDate: '1965',
    },
    {
      id: 'mock-4',
      title: 'The Name of the Wind',
      authors: ['Patrick Rothfuss'],
      description:
        'The riveting first-person narrative of Kvothe — a magically gifted young man who grows to be the most notorious wizard his world has ever seen. Told as a biography, this is a masterpiece of world-building and lyrical prose set in a world with a beautiful, internally consistent magic system.',
      categories: ['Fantasy', 'Epic Fantasy'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8691451-M.jpg',
      infoLink: 'https://books.google.com/books?id=name-of-the-wind',
      publisher: 'DAW Books',
      publishedDate: '2007',
    },
    {
      id: 'mock-5',
      title: 'Sapiens: A Brief History of Humankind',
      authors: ['Yuval Noah Harari'],
      description:
        'A bold, wide-ranging and provocative account of how biology and history have defined us and enhanced our understanding of what it means to be human. Covering 70,000 years of history in 400 pages, Harari asks: How did Homo sapiens come to dominate the planet?',
      categories: ['Non-Fiction', 'History', 'Anthropology'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8739161-M.jpg',
      infoLink: 'https://books.google.com/books?id=sapiens',
      publisher: 'Harper',
      publishedDate: '2015',
    },
    {
      id: 'mock-6',
      title: 'The Hitchhiker\'s Guide to the Galaxy',
      authors: ['Douglas Adams'],
      description:
        'Seconds before the Earth is demolished to make way for a hyperspace express route, Arthur Dent is whisked off the planet by his friend Ford Prefect, a researcher for the revised edition of The Hitchhiker\'s Guide to the Galaxy. A landmark of comic science fiction.',
      categories: ['Science Fiction', 'Comedy'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8739094-M.jpg',
      infoLink: 'https://books.google.com/books?id=hitchhikers-guide',
      publisher: 'Pan Books',
      publishedDate: '1979',
    },
    {
      id: 'mock-7',
      title: 'Thinking, Fast and Slow',
      authors: ['Daniel Kahneman'],
      description:
        'Nobel Prize–winning psychologist Daniel Kahneman takes you on a groundbreaking tour of the mind and explains the two systems that drive the way we think — System 1 is fast, intuitive, and emotional; System 2 is slower, more deliberative, and more logical.',
      categories: ['Psychology', 'Behavioural Economics', 'Non-Fiction'],
      thumbnail: 'https://covers.openlibrary.org/b/id/10519456-M.jpg',
      infoLink: 'https://books.google.com/books?id=thinking-fast-slow',
      publisher: 'Farrar, Straus and Giroux',
      publishedDate: '2011',
    },
    {
      id: 'mock-8',
      title: 'The Midnight Library',
      authors: ['Matt Haig'],
      description:
        'Between life and death there is a library, and within that library the shelves go on forever. Every book provides a chance to try another life you could have lived. A profound and dazzling novel about the choices we make, and the book of all possible lives.',
      categories: ['Literary Fiction', 'Fantasy'],
      thumbnail: 'https://covers.openlibrary.org/b/id/10361120-M.jpg',
      infoLink: 'https://books.google.com/books?id=midnight-library',
      publisher: 'Canongate Books',
      publishedDate: '2020',
    },
    {
      id: 'mock-9',
      title: 'Zero to One',
      authors: ['Peter Thiel', 'Blake Masters'],
      description:
        'The lessons Peter Thiel shares in Zero to One will help you find value in unexpected places, and build a company that will succeed. Every moment in business happens only once — the next Bill Gates will not build an operating system; the next Larry Page will not make a search engine.',
      categories: ['Business', 'Entrepreneurship', 'Technology'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8739211-M.jpg',
      infoLink: 'https://books.google.com/books?id=zero-to-one',
      publisher: 'Crown Business',
      publishedDate: '2014',
    },
    {
      id: 'mock-10',
      title: 'The Way of Kings',
      authors: ['Brandon Sanderson'],
      description:
        'An epic fantasy set on the storm-ravaged world of Roshar, The Way of Kings is the first volume of the Stormlight Archive — a sweeping story about honour, war, the nature of power, and the magic of Stormlight. Sanderson\'s intricate world-building and magic systems are unmatched.',
      categories: ['Epic Fantasy', 'Fantasy'],
      thumbnail: 'https://covers.openlibrary.org/b/id/10090829-M.jpg',
      infoLink: 'https://books.google.com/books?id=way-of-kings',
      publisher: 'Tor Books',
      publishedDate: '2010',
    },
    {
      id: 'mock-11',
      title: 'Neuromancer',
      authors: ['William Gibson'],
      description:
        'The novel that defined the cyberpunk genre. Case was the sharpest data-thief in the Matrix until he double-crossed the wrong people — a story of artificial intelligence, corporate intrigue, and the blurred line between human and machine. Winner of the Hugo, Nebula, and Philip K. Dick Awards.',
      categories: ['Science Fiction', 'Cyberpunk'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8739091-M.jpg',
      infoLink: 'https://books.google.com/books?id=neuromancer',
      publisher: 'Ace Books',
      publishedDate: '1984',
    },
    {
      id: 'mock-12',
      title: 'The Lean Startup',
      authors: ['Eric Ries'],
      description:
        'How today\'s entrepreneurs use continuous innovation to create radically successful businesses. Ries introduces the Build-Measure-Learn feedback loop and shows how to apply it to any business, from a startup in a garage to a Fortune 500 company.',
      categories: ['Business', 'Entrepreneurship'],
      thumbnail: 'https://covers.openlibrary.org/b/id/8739301-M.jpg',
      infoLink: 'https://books.google.com/books?id=lean-startup',
      publisher: 'Crown Business',
      publishedDate: '2011',
    },
  ];
}
