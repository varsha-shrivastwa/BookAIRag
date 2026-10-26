# DocAI — Document Chat with RAG

An intelligent document Q&A assistant that lets you upload files, ask questions about their contents, and get AI-generated answers grounded in your documents. Built with **Next.js** (Frontend), **NestJS** (Backend), **PostgreSQL + pgvector** (Vector Store), and a multi-provider AI layer supporting **Google Gemini** and **Ollama**.

---

## What It Does

- **Upload documents** — PDF, DOCX, TXT, MD, XLSX, XLS, CSV
- **Real-time progress bar** — live extraction sub-progress (classify → vision/OCR → text → index) via SSE
- **Chat with documents** — click a document in the sidebar to select it, then ask questions; answers are streamed token-by-token
- **Source citations** — each answer includes expandable citation cards showing the source page, section, content type, and an excerpt
- **Document summarization** — full-document or section-level summaries on demand
- **General AI chat** — free-form conversation with conversation history, separate from document chat
- **Multi-provider AI** — switch between Google Gemini and Ollama without code changes
- **JWT authentication** — register and login; all data is scoped per user

---

## Architecture

```
                    +---------------------------+
                    |   Next.js Frontend        |
                    |   (Dark glassmorphism UI) |
                    +------------+--------------+
                                 |
                        HTTP REST / SSE
                                 v
                    +---------------------------+
                    |   NestJS Backend          |
                    +--+----------+----------+--+
                       |          |          |
              Auth / JWT   Document     AI Provider
                       |    Pipeline     (Gemini / Ollama)
                       v          |          |
              +-----------+       v          v
              | users     |  +---------+  +---------------+
              | (SQLite-  |  | docs /  |  | Embeddings +  |
              |  style PG)|  | chunks  |  | LLM streaming |
              +-----------+  +---------+  +---------------+
                                  |
                    +-------------+-------------+
                    | PostgreSQL + pgvector      |
                    | (768-dim HNSW index)       |
                    +---------------------------+
```

### RAG Pipeline (per document)

```
Upload → Classify pages (text vs scanned)
       → Vision/OCR for scanned pages (bounded concurrency)
       → Text extraction + chunking
       → Batch embedding generation
       → pgvector storage with HNSW index
       → Status: ready
```

### RAG Retrieval (per query)

```
User query → Multi-query expansion (2-3 sub-questions via LLM)
           → Parallel retrieval: semantic search + keyword search
             + page-range search + section-heading search
           → Reciprocal Rank Fusion (RRF) merging
           → Page-spread diversity filter
           → Diverse fallback if < 6 chunks found
           → Context assembly → LLM streaming → Sources event
```

---

## Project Structure

```
RAGChatbot/
├── docker-compose.yml          # PostgreSQL + pgvector container
├── SETUP.md                    # Detailed local setup guide
├── README.md
│
├── backend/                    # NestJS API (Pure JavaScript + Babel)
│   ├── bootstrap.js            # Entry point (nodemon target)
│   ├── .env.example
│   └── src/
│       ├── main.js             # App bootstrap (port 4000)
│       ├── app.module.js       # Root module wiring
│       └── modules/
│           ├── ai/             # Multi-provider AI abstraction
│           │   ├── ai.service.js         # Provider router
│           │   └── providers/
│           │       ├── gemini.provider.js
│           │       └── ollama.provider.js
│           ├── auth/           # JWT register / login / /me
│           ├── documents/      # Core document pipeline
│           │   ├── documents.controller.js   # Upload, list, delete, SSE progress
│           │   ├── documents.service.js      # Orchestrates processing
│           │   ├── document-processor.service.js  # Extract, classify, chunk
│           │   ├── doc-chat.controller.js    # /doc-chat/stream, /doc-chat/summarize
│           │   ├── doc-chat.service.js       # RAG retrieval + streaming
│           │   ├── entities/
│           │   │   ├── document.schema.js    # DB table definitions
│           │   │   └── document-migrations.js # Non-destructive ALTER TABLE helpers
│           │   ├── extraction/
│           │   │   ├── pdf-renderer.service.js    # PDF → JPEG via pdfjs-dist
│           │   │   └── vision-extractor.service.js # Page image → structured text
│           │   └── prompts/
│           │       ├── doc-rag.prompt.js     # RAG system prompt
│           │       └── summary.prompt.js     # Full / section summary prompts
│           ├── settings/       # AI provider settings (GET/PUT /api/settings/ai)
│           ├── vector-store/   # pgvector: embed, insert, semantic search
│           ├── books/          # Legacy Google Books search endpoint
│           ├── chat/           # General AI chat with history (non-document)
│           └── health/         # GET /api/health
│
└── frontend/                   # Next.js App (Pure JavaScript)
    └── src/
        ├── app/                # App Router (layout, page, globals.css)
        ├── components/
        │   ├── layout/
        │   │   └── UnifiedSidebar.jsx   # Documents + chat history + upload
        │   ├── chat/
        │   │   ├── AIChatWindow.jsx     # General AI chat
        │   │   ├── DocChatContainer.jsx # Document Q&A with source display
        │   │   ├── DocSourcesPanel.jsx  # Citation cards per message
        │   │   ├── DocumentSummaryPanel.jsx  # Full / section summaries
        │   │   ├── MessageItem.jsx      # Markdown message renderer
        │   │   └── ChatInput.jsx        # Input with send/stop
        │   ├── documents/
        │   │   └── ...                  # Document list, upload progress steps
        │   └── settings/
        │       └── SettingsPanel.jsx    # AI provider / model switcher
        ├── context/
        │   ├── DocumentsContext.jsx     # documents[], selectedIds, toggleSelection
        │   └── ConversationsContext.jsx # Chat history state
        └── services/
            ├── documentsApi.js  # Upload, list, SSE progress, doc-chat stream
            ├── aiChatApi.js     # General AI chat stream
            └── settingsApi.js   # AI settings read/write
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/) — for PostgreSQL + pgvector
- A **Google Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com)
  - Or [Ollama](https://ollama.com) installed locally as an alternative

---

## Quick Start

### 1. Start PostgreSQL

```bash
docker compose up postgres -d
```

### 2. Configure and run the backend

```bash
cd backend
npm install
cp .env.example .env
# Open .env and set GEMINI_API_KEY
npm run start:dev
```

Backend: `http://localhost:4000/api`  
Swagger: `http://localhost:4000/docs`

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev -- --webpack
```

> Always use `--webpack`. Turbopack is not stable with this codebase.

App: `http://localhost:3000`

---

## Environment Variables

### `backend/.env`

| Variable               | Description                                        | Default                  |
|------------------------|----------------------------------------------------|--------------------------|
| `PORT`                 | Backend port                                       | `4000`                   |
| `NODE_ENV`             | Environment                                        | `development`            |
| `DATABASE_URL`         | PostgreSQL connection string                       | —                        |
| `AI_PROVIDER`          | Active AI provider: `gemini` or `ollama`           | `gemini`                 |
| `GEMINI_API_KEY`       | Google Gemini API key                              | —                        |
| `EMBEDDING_MODEL`      | Gemini embedding model                             | `gemini-embedding-001`   |
| `LLM_MODEL`            | Gemini chat model                                  | `gemini-2.0-flash`       |
| `EMBEDDING_DIMENSION`  | Vector dimensions (must match the active model)    | `768`                    |
| `OLLAMA_BASE_URL`      | Ollama server URL                                  | `http://localhost:11434` |
| `OLLAMA_LLM_MODEL`     | Ollama chat model                                  | `llama3.2`               |
| `OLLAMA_EMBEDDING_MODEL` | Ollama embedding model                           | `nomic-embed-text`       |
| `OLLAMA_VISION_MODEL`  | Ollama vision model (for scanned PDFs)             | `llava`                  |
| `JWT_SECRET`           | Secret key for JWT signing                         | —                        |
| `JWT_EXPIRES_IN`       | Token expiry                                       | `7d`                     |
| `CORS_ORIGIN`          | Allowed frontend origin                            | `http://localhost:3000`  |

### `frontend/.env`

| Variable               | Description              | Default                      |
|------------------------|--------------------------|------------------------------|
| `NEXT_PUBLIC_API_URL`  | Backend API base URL     | `http://localhost:4000/api`  |

---

## API Endpoints

### Auth

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| `POST` | `/api/auth/register`  | Register a new user            |
| `POST` | `/api/auth/login`     | Login, returns JWT token       |
| `GET`  | `/api/auth/me`        | Get current user info          |

### Documents

| Method   | Endpoint                              | Description                            |
|----------|---------------------------------------|----------------------------------------|
| `POST`   | `/api/documents/upload`               | Upload a document (multipart/form-data)|
| `GET`    | `/api/documents/upload/progress/:id`  | SSE stream of processing progress      |
| `GET`    | `/api/documents`                      | List user's documents                  |
| `GET`    | `/api/documents/:id/sections`         | Get section headings for a document    |
| `POST`   | `/api/documents/:id/retry`            | Retry a failed document                |
| `DELETE` | `/api/documents/:id`                  | Delete a document and its chunks       |

### Document Chat

| Method | Endpoint                  | Description                                      |
|--------|---------------------------|--------------------------------------------------|
| `POST` | `/api/doc-chat/stream`    | SSE: stream AI answer over selected documents    |
| `POST` | `/api/doc-chat/summarize` | SSE: stream a full or section summary            |

### General Chat

| Method | Endpoint            | Description                              |
|--------|---------------------|------------------------------------------|
| `POST` | `/api/chat/stream`  | SSE: general AI chat with history        |
| `POST` | `/api/chat/title`   | Generate a title for a conversation      |

### Settings & Other

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| `GET`  | `/api/settings/ai`    | Get current AI provider config |
| `PUT`  | `/api/settings/ai`    | Update AI provider / model     |
| `GET`  | `/api/books/search`   | Search Google Books catalog    |
| `GET`  | `/api/health`         | Service health check           |

---

## Switching AI Providers

Edit `backend/.env`:

```env
# Use Gemini (default)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here

# OR use Ollama (local, no API key needed)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

When switching providers, re-index your documents — embeddings from Gemini and Ollama are not compatible.

For Ollama, pull the required models first:
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
ollama pull llava   # optional: only needed for scanned PDF vision analysis
```

---

## Supported File Types

| Format | Extension       | Notes                                     |
|--------|-----------------|-------------------------------------------|
| PDF    | `.pdf`          | Text-layer + scanned (OCR via vision AI)  |
| Word   | `.docx`         | Text and tables                           |
| Text   | `.txt`, `.md`   | Plain text and Markdown                   |
| Excel  | `.xlsx`, `.xls` | Tabular data                              |
| CSV    | `.csv`          | Comma-separated values                    |

---

## Running with Docker Compose

```bash
cp backend/.env.example backend/.env
# Set GEMINI_API_KEY in backend/.env

docker compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000        |
| Backend   | http://localhost:4000/api    |
| Swagger   | http://localhost:4000/docs   |
| Postgres  | localhost:5432               |

---

## License

MIT
