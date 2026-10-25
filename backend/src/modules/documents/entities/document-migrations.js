/**
 * Non-destructive ALTER TABLE migrations for existing document_chunks rows.
 * These are safe to run repeatedly — IF NOT EXISTS / IF NOT EXISTS pattern.
 */

export const ADD_DOCUMENTS_FILE_PATH = `
  ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS file_path     TEXT,
    ADD COLUMN IF NOT EXISTS retry_count   INTEGER NOT NULL DEFAULT 0;
`;

export const ADD_CHUNK_METADATA_COLUMNS = `
  ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS page_number     INTEGER,
    ADD COLUMN IF NOT EXISTS section_heading TEXT,
    ADD COLUMN IF NOT EXISTS content_type    VARCHAR(30) DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS metadata        JSONB DEFAULT '{}';
`;

export const ADD_CHUNK_METADATA_INDEXES = `
  CREATE INDEX IF NOT EXISTS document_chunks_page_number_idx
    ON document_chunks(document_id, page_number);

  CREATE INDEX IF NOT EXISTS document_chunks_content_type_idx
    ON document_chunks(content_type);
`;

/**
 * Tracks indexing progress so the SSE stream can report % complete.
 * indexed_chunks = chunks stored so far; chunk_count = total expected when set
 * during the indexing phase (overwritten with actual count at completion).
 */
export const ADD_INDEXING_PROGRESS = `
  ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS indexed_chunks INTEGER NOT NULL DEFAULT 0;
`;

/**
 * Tracks extraction sub-progress (page-by-page) so the SSE stream can show
 * progress before the indexing stage begins.
 * extracted_pages = pages processed so far; total_pages = page count of the PDF.
 */
export const ADD_EXTRACTION_PROGRESS = `
  ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS extracted_pages INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_pages     INTEGER NOT NULL DEFAULT 0;
`;

/**
 * GIN index on the tsvector of chunk content.
 * Enables fast PostgreSQL full-text (keyword) search alongside vector search.
 * Non-destructive — IF NOT EXISTS.
 */
export const ADD_FULLTEXT_SEARCH_INDEX = `
  CREATE INDEX IF NOT EXISTS document_chunks_content_fts_idx
    ON document_chunks
    USING GIN (to_tsvector('english', content));
`;
