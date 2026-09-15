/**
 * Database Seed Script
 * --------------------
 * Fetches curated books from Google Books API, generates Gemini embeddings
 * for each, and upserts them into the PostgreSQL pgvector table.
 *
 * Usage:
 *   npx babel-node src/seed.js
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

dotenv.config();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DB_URL = process.env.DATABASE_URL || 'postgresql://raguser:ragpass@localhost:5432/book_rag_db';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';

const pool = new Pool({ connectionString: DB_URL });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || 'dummy-key');

// ---------------------------------------------------------------------------
// Curated seed queries — each fetches the top result for a known great book
// ---------------------------------------------------------------------------
const SEED_QUERIES = [
  'Project Hail Mary Andy Weir',
  'Dune Frank Herbert',
  'The Name of the Wind Patrick Rothfuss',
  'Sapiens Yuval Noah Harari',
  'The Hitchhiker\'s Guide to the Galaxy Douglas Adams',
  'Thinking Fast and Slow Daniel Kahneman',
  'The Midnight Library Matt Haig',
  'Zero to One Peter Thiel',
  'The Way of Kings Brandon Sanderson',
  'Neuromancer William Gibson',
  'The Lean Startup Eric Ries',
  'Atomic Habits James Clear',
  'The Pragmatic Programmer David Thomas',
  'Clean Code Robert Martin',
  'Deep Work Cal Newport',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchBook(query) {
  try {
    const params = { q: query, maxResults: 1, printType: 'books' };

    const response = await axios.get(GOOGLE_BOOKS_BASE, { params });
    const item = response.data.items?.[0];
    if (!item) return null;

    const info = item.volumeInfo || {};
    return {
      googleBookId: item.id,
      title: info.title || 'Untitled',
      authors: info.authors || ['Unknown Author'],
      publisher: info.publisher || 'Unknown Publisher',
      publishedDate: info.publishedDate || '',
      description: info.description || info.subtitle || 'No description available.',
      categories: info.categories || ['General'],
      thumbnail: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null,
      infoLink: info.infoLink || '',
    };
  } catch (err) {
    console.error(`  ✗ Google Books fetch failed for "${query}": ${err.message}`);
    return null;
  }
}

function buildSemanticText(book) {
  const authors = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
  const categories = Array.isArray(book.categories) ? book.categories.join(', ') : book.categories;
  return `Title: ${book.title}\nAuthors: ${authors}\nCategories/Genres: ${categories}\nDescription: ${book.description}`;
}

async function generateEmbedding(text) {
  if (!GEMINI_API_KEY) {
    console.warn('  ⚠ GEMINI_API_KEY not set — storing zero-vector placeholder.');
    return new Array(768).fill(0);
  }
  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text.replace(/\n/g, ' '));
    return result.embedding.values;
  } catch (err) {
    console.error(`  ✗ Embedding generation failed: ${err.message}`);
    return new Array(768).fill(0);
  }
}

async function upsertBook(book, embedding) {
  const query = `
    INSERT INTO book_embeddings
      (google_book_id, title, authors, categories, description, thumbnail, info_link, embedding)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
    ON CONFLICT (google_book_id)
    DO UPDATE SET
      title       = EXCLUDED.title,
      description = EXCLUDED.description,
      embedding   = EXCLUDED.embedding
    RETURNING id;
  `;
  const values = [
    book.googleBookId,
    book.title,
    book.authors,
    book.categories,
    book.description,
    book.thumbnail,
    book.infoLink,
    JSON.stringify(embedding),
  ];
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

// ---------------------------------------------------------------------------
// Ensure the pgvector extension and table exist
// ---------------------------------------------------------------------------
async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS book_embeddings (
      id             SERIAL PRIMARY KEY,
      google_book_id VARCHAR(255) UNIQUE NOT NULL,
      title          TEXT NOT NULL,
      authors        TEXT[],
      categories     TEXT[],
      description    TEXT,
      thumbnail      TEXT,
      info_link      TEXT,
      embedding      vector(768),
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS book_embeddings_vector_idx
    ON book_embeddings
    USING hnsw (embedding vector_cosine_ops);
  `);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  console.log('📚 Book RAG Chatbot — Database Seed Script');
  console.log('==========================================');

  // 1. Connect & ensure schema
  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL\n');
  } catch (err) {
    console.error('❌ Cannot connect to PostgreSQL:', err.message);
    console.error('   Make sure docker-compose is running: docker compose up postgres -d');
    process.exit(1);
  }

  await ensureSchema();
  console.log('✅ Schema ready\n');

  // 2. Fetch, embed, and upsert each book
  let successCount = 0;
  for (let i = 0; i < SEED_QUERIES.length; i++) {
    const query = SEED_QUERIES[i];
    console.log(`[${i + 1}/${SEED_QUERIES.length}] Processing: "${query}"`);

    const book = await fetchBook(query);
    if (!book) {
      console.log('  ↳ Skipped (not found)\n');
      continue;
    }

    console.log(`  ↳ Found: "${book.title}" by ${book.authors.join(', ')}`);

    const semanticText = buildSemanticText(book);
    const embedding = await generateEmbedding(semanticText);
    const id = await upsertBook(book, embedding);

    console.log(`  ↳ Upserted (row id=${id}) ✓\n`);
    successCount++;

    // Small delay to avoid hitting rate limits
    if (i < SEED_QUERIES.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // 3. Summary
  console.log('==========================================');
  console.log(`✅ Seed complete: ${successCount}/${SEED_QUERIES.length} books upserted.`);

  const { rows } = await pool.query('SELECT COUNT(*) FROM book_embeddings');
  console.log(`📊 Total books in database: ${rows[0].count}`);

  await pool.end();
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
