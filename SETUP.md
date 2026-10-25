# DocAI — Setup Guide

End-to-end document question-answering chatbot powered by Google Gemini AI, pgvector, and RAG.

---

## What This Is

DocAI lets users upload PDF, DOCX, TXT, Markdown, Excel, or CSV files and ask natural-language questions about their content. Answers are grounded strictly in the uploaded documents with inline page citations. Scanned pages are OCR'd automatically via the Gemini Vision API.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 13+ (App Router), React |
| Backend | NestJS (pure JS + Babel), Express |
| Database | PostgreSQL 16 + pgvector extension |
| Embeddings | Google Gemini (`gemini-embedding-001`) |
| LLM | Google Gemini (`gemini-2.0-flash` or newer) |
| Vision / OCR | Google Gemini Vision API |
| Auth | JWT + bcrypt |
| File storage | Local filesystem |

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Node.js | 18.x | 20.x or 22.x recommended |
| npm | 9.x | Bundled with Node |
| Docker | 24.x | For PostgreSQL + pgvector |
| Docker Compose | 2.x | Bundled with Docker Desktop |
| Google Gemini API key | — | Free tier available at [aistudio.google.com](https://aistudio.google.com) |

---

## 1 · Get a Gemini API Key

1. Go to **https://aistudio.google.com**
2. Click **Get API key → Create API key in new project**
3. Copy the key (starts with `AIza...` or `AQ...`)

The same key is used for:
- Text embeddings (`gemini-embedding-001`)
- Chat responses (e.g., `gemini-2.0-flash`)
- Vision / OCR analysis (`gemini-2.0-flash`)

---

## 2 · Clone & Configure

```bash
git clone <repo-url>
cd RAGChatbot
```

### Backend configuration

Copy the example env file and fill in your key:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=4000
NODE_ENV=development

# PostgreSQL — use localhost when running the DB in Docker locally
DATABASE_URL=postgresql://raguser:ragpass@localhost:5432/book_rag_db

# Your Gemini API key
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Embedding & LLM models
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSION=768
LLM_MODEL=gemini-2.0-flash

# CORS — must match the port your frontend runs on
CORS_ORIGIN=http://localhost:3000

# Auth
JWT_SECRET=change_this_to_a_long_random_string_in_production
JWT_EXPIRES_IN=7d
```

> **Important:** `LLM_MODEL` must be a model your API key has access to.
> Run `curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"` to list available models.

### Frontend configuration

```bash
cp frontend/.env.local.example frontend/.env.local
```

`frontend/.env.local` should contain:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## 3 · Start PostgreSQL with pgvector

```bash
# From the project root
docker compose up -d postgres
```

Wait for it to become healthy:

```bash
docker compose ps
# postgres should show: healthy
```

The database is automatically created with the pgvector extension. Tables are created on first backend start via `onModuleInit`.

---

## 4 · Start the Backend

```bash
cd backend
npm install
npm run start:dev
```

Verify it started:

```
✔ Book RAG Chatbot Backend running on http://localhost:4000/api
✔ Swagger docs available at http://localhost:4000/docs
✔ Document tables initialized.
✔ Users table initialized.
✔ PostgreSQL pgvector extension & table initialized.
```

If you see `pdfjs-dist X.Y.Z initialized` on first PDF upload — PDF processing is working.

---

## 5 · Start the Frontend

```bash
cd frontend
npm install
npm run dev -- --webpack
```

> **Must use `--webpack`** — Turbopack is not compatible with this codebase and will crash on startup.

Open **http://localhost:3000** in your browser.

---

## 6 · First Use

1. Click **Register** and create an account
2. Upload a document (PDF, DOCX, TXT, MD, XLSX, or CSV up to 20 MB)
3. Watch the processing pipeline: Uploading → Extracting → Analyzing → Indexing → Ready
4. Select the document (checkbox) in the sidebar
5. Ask a question in the chat input

---

## 7 · Running Tests

### Automated security tests

Requires the backend to be running:

```bash
cd backend
npm run test:security
```

These tests verify: auth enforcement, file type rejection, magic byte validation, user isolation, input validation, and document deletion cascade.

### Manual QA checklist

See `backend/test/qa-checklist.md` for the full test matrix covering document types, answer accuracy, visual content, multi-document chat, prompt injection, and rate limiting.

---

## 8 · Docker Compose (Full Stack)

To run everything in Docker:

```bash
# Create root .env from root .env.example
cp .env.example .env
# Add your GEMINI_API_KEY to .env

docker compose up --build
```

Services:
- **postgres** → port 5432
- **backend** → port 4000
- **frontend** → port 3000

> When running in Docker, set `DATABASE_URL=postgresql://raguser:ragpass@postgres:5432/book_rag_db`
> (use `postgres` as the hostname, not `localhost`).

---

## 9 · Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `CORS error` in browser console | `CORS_ORIGIN` mismatch | Set `CORS_ORIGIN=http://localhost:3000` in `backend/.env` |
| `Cannot find module 'pdfjs-dist'` | Missing package | Run `npm install` in `backend/` |
| `Cannot find module '@napi-rs/canvas'` | Native binary not installed | Run `npm install @napi-rs/canvas` in `backend/` |
| PDF uploads stuck at "Extracting" | pdfjs-dist not loading | Check backend logs for `pdfjs-dist` initialization message |
| `model not found` error from Gemini | Invalid model name | Update `LLM_MODEL` in `backend/.env` to `gemini-2.0-flash` |
| Frontend shows blank screen | Turbopack crash | Run with `npm run dev -- --webpack` |
| Login/chat gets `401 Unauthorized` | Expired JWT or wrong secret | Log out and log in again; verify `JWT_SECRET` matches |
| Database connection refused | Postgres not running | Run `docker compose up -d postgres` |
| Answers say "insufficient information" | Documents not selected | Click the checkbox next to documents in the sidebar |
| Rate limit `429` on uploads | Too many uploads (>10/15min) | Wait 15 minutes before uploading more |

---

## 10 · Upload Limits

| Limit | Value |
|-------|-------|
| Max file size | 20 MB |
| Max documents per account | 50 |
| Max uploads per IP per 15 minutes | 10 |
| Max query length | 2000 characters |
| Max documents per chat query | 20 |

---

## 11 · Supported File Types

| Format | Extension | Notes |
|--------|-----------|-------|
| PDF | `.pdf` | Text extraction + OCR for scanned pages |
| Word | `.docx` | Headings, paragraphs, embedded tables |
| Plain text | `.txt` | UTF-8 encoded |
| Markdown | `.md` | Headings used as section markers |
| Excel | `.xlsx`, `.xls` | Each sheet extracted as markdown tables |
| CSV | `.csv` | Tabular data |

---

## 12 · Architecture Overview

```
Browser
  └── Next.js frontend (port 3000)
        ├── AuthContext (JWT in localStorage)
        ├── DocumentsContext (document list + selection)
        └── API calls to backend (http://localhost:4000/api)

Backend (NestJS, port 4000)
  ├── POST /api/auth/register + /login     → JWT
  ├── POST /api/documents/upload           → stores file, starts async processing
  ├── GET  /api/documents/upload/progress/:id (SSE) → processing status stream
  ├── GET  /api/documents                  → list user's documents
  ├── DELETE /api/documents/:id            → delete doc + chunks (cascade)
  ├── POST /api/doc-chat/stream (SSE)      → RAG query → Gemini stream
  └── POST /api/doc-chat/summarize (SSE)   → summary stream

Document Processing Pipeline (async, fire-and-forget)
  1. DocumentProcessorService.extract()
     ├── PDF: pdfjs-dist text layer + Gemini Vision for scanned/mixed pages
     ├── DOCX: mammoth → HTML → TurndownService → Markdown
     ├── XLSX/CSV: xlsx → Markdown tables
     └── TXT/MD: direct text
  2. Chunking (1400 chars, 200 overlap, max 2500 chunks)
  3. Embedding via gemini-embedding-001 (batches of 6)
  4. Storage in PostgreSQL document_chunks (pgvector 768-dim)

RAG Query Pipeline (per user message)
  1. Query expansion → 2-3 sub-queries (Gemini)
  2. Multi-strategy retrieval:
     a. Semantic search (pgvector HNSW cosine)
     b. Visual boost (content_type filter for tables/charts)
     c. Page-range filter (if "page N" mentioned)
     d. Full-text search (PostgreSQL GIN tsvector)
     e. Section heading patterns (chapter/section references)
  3. Reciprocal Rank Fusion → page diversity → top 12 chunks
  4. Context building with [N] citation markers
  5. Gemini streaming response with inline citations
  6. Source metadata emitted as final SSE event
```
