/**
 * Schema definition for books & pgvector embeddings table in PostgreSQL
 */
export const BOOK_EMBEDDINGS_TABLE_SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS book_embeddings (
    id SERIAL PRIMARY KEY,
    google_book_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    authors TEXT[],
    categories TEXT[],
    description TEXT,
    thumbnail TEXT,
    info_link TEXT,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS book_embeddings_vector_idx 
  ON book_embeddings 
  USING hnsw (embedding vector_cosine_ops);
`;
