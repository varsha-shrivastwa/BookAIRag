# Book RAG Chatbot

An intelligent, conversational book recommendation assistant built with **Next.js** (Frontend), **NestJS** (Backend), **PostgreSQL + pgvector** (Vector Database), **Google Books API** (Catalog Source), and a **Retrieval-Augmented Generation (RAG)** pipeline powered by **Google Gemini**.

---

## Architecture Overview

```
                      +-------------------------+
                      |   Next.js 14 Frontend   |
                      |  (Glassmorphism Dark UI) |
                      +------------+------------+
                                   |
                          HTTP REST / SSE
                                   v
                      +-------------------------+
                      |  NestJS / Node Backend  |
                      +----+---------------+----+
                           |               |
          Google Books API |               | RAG Vector Search
                           v               v
               +---------------+   +-------------------+
               | Google Books  |   | PostgreSQL +      |
               | Catalog Data  |   | pgvector (768-dim)|
               +---------------+   +-------------------+
                                           ^
                                           | Embeddings & Chat
                                   +-------+-------+
                                   | Google Gemini |
                                   +---------------+
```

---

## Project Structure

```
RAGChatbot/
├── docker-compose.yml        # PostgreSQL + pgvector + backend + frontend
├── .env.example              # Root environment variable template
├── README.md
│
├── backend/                  # NestJS API Service (Pure JavaScript)
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   ├── babel.config.js       # Decorator support for NestJS in JS
│   └── src/
│       ├── main.js           # App entry point (port 4000)
│       ├── app.module.js     # Root module
│       ├── seed.js           # DB seed script
│       └── modules/
│           ├── books/        # Google Books API integration
│           ├── vector-store/ # pgvector embeddings & vector search
│           ├── rag/          # RAG context retrieval & prompt management
│           ├── chat/         # Chat REST controller & streaming SSE
│           └── health/       # Health check endpoint
│
└── frontend/                 # Next.js 14 Web Application (Pure JavaScript)
    ├── Dockerfile
    ├── .env.example
    ├── package.json
    ├── next.config.js
    └── src/
        ├── app/              # App Router (layout, page, globals.css)
        ├── components/       # Glassmorphism UI, Chat UI, Book Cards
        ├── services/         # API HTTP client
        └── constants/        # Prompt suggestions & app defaults
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/)
- A **Google Gemini API key** — get one free at [aistudio.google.com](https://aistudio.google.com) (requires Generative Language API enabled in your Google Cloud project)

---

## Quick Start (Local Development)

### Step 1: Start PostgreSQL

```bash
# From the project root
cp .env.example .env

docker compose up postgres -d
```

Verify it's healthy:
```bash
docker ps
```

---

### Step 2: Run the Backend

```bash
cd backend

npm install

cp .env.example .env
# Edit .env and set your GEMINI_API_KEY

npm run start:dev
```

Backend available at `http://localhost:4000/api`  
Swagger docs at `http://localhost:4000/docs`

---

### Step 3: Seed the Database

With the backend running and Postgres up:

```bash
cd backend
npx babel-node src/seed.js
```

This fetches 15 curated books from Google Books, generates Gemini embeddings, and stores them in pgvector.

---

### Step 4: Run the Frontend

```bash
cd frontend

npm install

cp .env.example .env
# Edit .env — set NEXT_PUBLIC_API_URL=http://localhost:4000/api

npm run dev
```

App available at `http://localhost:3000`

---

## Running with Docker Compose

Fill in your env files first:

```bash
cp .env.example .env
cp backend/.env.example backend/.env   # set GEMINI_API_KEY
cp frontend/.env.example frontend/.env
```

Then build and start everything:

```bash
docker compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000        |
| Backend   | http://localhost:4000/api    |
| Swagger   | http://localhost:4000/docs   |
| Postgres  | localhost:5432               |

---

## Environment Variables

### `backend/.env`

| Variable           | Description                              | Default               |
|--------------------|------------------------------------------|-----------------------|
| `PORT`             | Backend port                             | `4000`                |
| `NODE_ENV`         | Environment                              | `development`         |
| `DATABASE_URL`     | PostgreSQL connection string             | —                     |
| `GEMINI_API_KEY`   | Google Gemini API key                    | —                     |
| `EMBEDDING_MODEL`  | Gemini embedding model                   | `gemini-embedding-001`|
| `EMBEDDING_DIMENSION` | Vector dimensions                     | `768`                 |
| `LLM_MODEL`        | Gemini chat model                        | `gemini-3.6-flash`    |
| `CORS_ORIGIN`      | Allowed frontend origin                  | `http://localhost:3000`|

### `frontend/.env`

| Variable                | Description              | Default                        |
|-------------------------|--------------------------|--------------------------------|
| `NEXT_PUBLIC_API_URL`   | Backend API base URL     | `http://localhost:4000/api`    |

---

## API Endpoints

| Method | Endpoint            | Description                              |
|--------|---------------------|------------------------------------------|
| `POST` | `/api/chat`         | Get book recommendations (full response) |
| `POST` | `/api/chat/stream`  | Stream recommendations token-by-token (SSE) |
| `GET`  | `/api/books/search` | Search Google Books catalog              |
| `GET`  | `/api/health`       | Service health check                     |

### Example Chat Request

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Recommend a great science fiction book",
    "history": [],
    "limit": 5
  }'
```

---

## How the RAG Pipeline Works

1. **Catalog Ingestion** — Books are fetched from Google Books API and processed into semantic text (title, authors, genre, description).
2. **Embedding Generation** — Text is converted into 768-dimensional vectors using `gemini-embedding-001`.
3. **pgvector Storage** — Vectors and metadata are stored in PostgreSQL with an HNSW index for fast cosine similarity search.
4. **Vector Retrieval** — User queries are embedded and matched against stored book vectors using cosine similarity (`<=>` operator).
5. **RAG Prompt Synthesis** — Top-matched books are injected into a system prompt and sent to `gemini-3.6-flash` to generate personalised, natural recommendations.

---

## License

MIT
