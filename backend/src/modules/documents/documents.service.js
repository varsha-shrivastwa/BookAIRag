import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  CREATE_DOCUMENTS_TABLE,
  CREATE_DOCUMENT_CHUNKS_TABLE,
  CREATE_DOCUMENT_CHUNKS_INDEX,
} from './entities/document.schema.js';
import {
  ADD_DOCUMENTS_FILE_PATH,
  ADD_CHUNK_METADATA_COLUMNS,
  ADD_CHUNK_METADATA_INDEXES,
  ADD_FULLTEXT_SEARCH_INDEX,
  ADD_INDEXING_PROGRESS,
  ADD_EXTRACTION_PROGRESS,
} from './entities/document-migrations.js';
import { DocumentProcessorService } from './document-processor.service.js';
import { VectorStoreService } from '../vector-store/vector-store.service.js';

const EMBED_BATCH_SIZE = 100; // batchEmbedContents supports up to 100 per call
const MAX_RETRIES = 3;
const MAX_DOCUMENTS_PER_USER = 50;

function getUploadDir(configService) {
  return configService.get('UPLOAD_DIR') || path.join(os.tmpdir(), 'docai-uploads');
}

@Injectable()
export class DocumentsService {
  constructor(configService, documentProcessorService, vectorStoreService) {
    this.configService = configService;
    this.documentProcessorService = documentProcessorService;
    this.vectorStoreService = vectorStoreService;
    this.logger = new Logger(DocumentsService.name);

    const connectionString =
      this.configService.get('DATABASE_URL') ||
      'postgresql://raguser:ragpass@localhost:5432/book_rag_db';
    this.pool = new Pool({ connectionString });
    this.uploadDir = getUploadDir(configService);
  }

  async onModuleInit() {
    // Ensure upload directory exists
    await fs.promises.mkdir(this.uploadDir, { recursive: true });

    try {
      await this.pool.query(CREATE_DOCUMENTS_TABLE);
      await this.pool.query(CREATE_DOCUMENT_CHUNKS_TABLE);
      await this.pool.query(CREATE_DOCUMENT_CHUNKS_INDEX);
      await this.pool.query(ADD_DOCUMENTS_FILE_PATH);
      await this.pool.query(ADD_CHUNK_METADATA_COLUMNS);
      await this.pool.query(ADD_CHUNK_METADATA_INDEXES);
      await this.pool.query(ADD_FULLTEXT_SEARCH_INDEX);
      await this.pool.query(ADD_INDEXING_PROGRESS);
      await this.pool.query(ADD_EXTRACTION_PROGRESS);
      this.logger.log('Document tables initialized.');
    } catch (error) {
      this.logger.warn(`Could not initialize document tables: ${error.message}`);
    }
  }

  // ── File Persistence ───────────────────────────────────────────────────────

  async saveUploadedFile(documentId, buffer) {
    const filePath = path.join(this.uploadDir, `${documentId}.bin`);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  async loadUploadedFile(filePath) {
    try {
      return await fs.promises.readFile(filePath);
    } catch (err) {
      throw new Error(`Cannot read stored file: ${err.message}. The file may have been removed.`);
    }
  }

  async deleteUploadedFile(filePath) {
    if (!filePath) return;
    try { await fs.promises.unlink(filePath); } catch { /* already gone */ }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createDocument(userId, name, sizeBytes, mimeType) {
    const countRes = await this.pool.query(
      'SELECT COUNT(*) FROM documents WHERE user_id = $1',
      [userId],
    );
    if (parseInt(countRes.rows[0].count, 10) >= MAX_DOCUMENTS_PER_USER) {
      throw new BadRequestException(
        `Upload limit reached. You can store up to ${MAX_DOCUMENTS_PER_USER} documents. Delete some before uploading more.`,
      );
    }

    const result = await this.pool.query(
      `INSERT INTO documents (user_id, name, size_bytes, mime_type, status)
       VALUES ($1, $2, $3, $4, 'uploading') RETURNING *`,
      [userId, name, sizeBytes, mimeType],
    );
    return result.rows[0];
  }

  async updateFilePath(documentId, filePath) {
    await this.pool.query(
      'UPDATE documents SET file_path = $2 WHERE id = $1',
      [documentId, filePath],
    );
  }

  async getDocument(documentId) {
    const result = await this.pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);
    return result.rows[0] || null;
  }

  async getUserDocuments(userId) {
    const result = await this.pool.query(
      'SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows;
  }

  async updateStatus(documentId, status, errorMessage = null) {
    await this.pool.query(
      `UPDATE documents SET status = $2, error_message = $3, updated_at = NOW() WHERE id = $1`,
      [documentId, status, errorMessage],
    );
  }

  async updateChunkCount(documentId, chunkCount) {
    await this.pool.query(
      `UPDATE documents SET chunk_count = $2, updated_at = NOW() WHERE id = $1`,
      [documentId, chunkCount],
    );
  }

  async clearDocumentChunks(documentId) {
    await this.pool.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);
  }

  async deleteDocument(documentId, userId) {
    const doc = await this.getDocument(documentId);
    if (doc && doc.user_id === userId && doc.file_path) {
      await this.deleteUploadedFile(doc.file_path);
    }
    const result = await this.pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [documentId, userId],
    );
    if (result.rowCount === 0) throw new NotFoundException('Document not found or access denied');
  }

  // ── Retry Failed Jobs ─────────────────────────────────────────────────────

  async retryDocument(documentId, userId) {
    const doc = await this.getDocument(documentId);
    if (!doc || doc.user_id !== userId) throw new NotFoundException('Document not found');
    if (doc.status !== 'error') throw new BadRequestException('Only failed documents can be retried');
    if (!doc.file_path) throw new BadRequestException('Original file is no longer available — please re-upload');
    if ((doc.retry_count || 0) >= MAX_RETRIES) {
      throw new BadRequestException(`Maximum retry attempts (${MAX_RETRIES}) reached`);
    }

    // Reset state
    await this.clearDocumentChunks(documentId);
    await this.pool.query(
      `UPDATE documents
       SET status = 'uploading', error_message = NULL, chunk_count = 0,
           retry_count = retry_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [documentId],
    );

    // Load the stored file and re-process (fire-and-forget)
    this.loadUploadedFile(doc.file_path)
      .then((buffer) =>
        this.processDocument(documentId, userId, buffer, doc.mime_type, doc.name),
      )
      .catch((err) => {
        this.logger.error(`Retry load failed for doc ${documentId}: ${err.message}`);
        this.updateStatus(documentId, 'error', err.message.slice(0, 500));
      });

    return { documentId, status: 'uploading', retryCount: (doc.retry_count || 0) + 1 };
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  async getDocumentSections(documentId, userId) {
    const doc = await this.getDocument(documentId);
    if (!doc || doc.user_id !== userId) throw new NotFoundException('Document not found');

    const result = await this.pool.query(
      `SELECT
         section_heading,
         MIN(page_number)  AS first_page,
         MAX(page_number)  AS last_page,
         COUNT(*)          AS chunk_count,
         MIN(chunk_index)  AS first_chunk_index
       FROM document_chunks
       WHERE document_id = $1
         AND section_heading IS NOT NULL
         AND section_heading != ''
       GROUP BY section_heading
       ORDER BY MIN(chunk_index)`,
      [documentId],
    );

    return result.rows.map((r) => ({
      heading:         r.section_heading,
      firstPage:       r.first_page,
      lastPage:        r.last_page,
      chunkCount:      parseInt(r.chunk_count),
      firstChunkIndex: parseInt(r.first_chunk_index),
    }));
  }

  // ── Processing Pipeline ───────────────────────────────────────────────────

  async processDocument(documentId, userId, buffer, mimeType, originalName) {
    try {
      await this.updateStatus(documentId, 'extracting');

      // Progress callback fired by the extractor as pages are processed
      const onExtractionProgress = async (extractedPages, totalPages) => {
        try {
          await this.pool.query(
            'UPDATE documents SET extracted_pages = $2, total_pages = $3 WHERE id = $1',
            [documentId, extractedPages, totalPages],
          );
        } catch { /* non-fatal */ }
      };

      const elements = await this.documentProcessorService.extract(
        buffer, mimeType, originalName, onExtractionProgress,
      );

      if (!elements || elements.length === 0) {
        await this.updateStatus(documentId, 'error', 'No readable content found in this document.');
        return;
      }

      await this.updateStatus(documentId, 'analyzing');
      const chunks = this.documentProcessorService.chunkElements(elements);

      if (chunks.length === 0) {
        await this.updateStatus(documentId, 'error', 'Document appears to contain no indexable content.');
        return;
      }

      // Transition to indexing and record the total chunk count upfront so the
      // SSE stream can compute a percentage before all chunks are stored.
      const totalChunks = chunks.length;
      await this.pool.query(
        `UPDATE documents
         SET status = 'indexing', chunk_count = $2, indexed_chunks = 0, updated_at = NOW()
         WHERE id = $1`,
        [documentId, totalChunks],
      );

      let stored = 0;

      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);

        // One API call embeds the whole batch (up to 100 texts at once)
        const embeddings = await this.vectorStoreService.generateEmbeddingBatch(
          batch.map((c) => c.content),
        );

        // Build a single multi-row INSERT for the entire batch
        const placeholders = [];
        const values = [];
        let p = 1;
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          placeholders.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4}::vector,$${p+5},$${p+6},$${p+7},$${p+8}::jsonb)`);
          values.push(
            documentId, userId, i + j, chunk.content,
            JSON.stringify(embeddings[j]),
            chunk.pageNumber ?? null,
            chunk.sectionHeading ?? null,
            chunk.contentType || 'text',
            JSON.stringify(chunk.metadata || {}),
          );
          p += 9;
        }
        await this.pool.query(
          `INSERT INTO document_chunks
             (document_id, user_id, chunk_index, content, embedding,
              page_number, section_heading, content_type, metadata)
           VALUES ${placeholders.join(',')}`,
          values,
        );
        stored += batch.length;

        // Report progress after every batch so the SSE poller can show a percentage
        await this.pool.query(
          'UPDATE documents SET indexed_chunks = $2 WHERE id = $1',
          [documentId, stored],
        );
      }

      await this.updateChunkCount(documentId, stored);
      await this.updateStatus(documentId, 'ready');
      this.logger.log(`Document ${documentId} indexed: ${stored} chunks.`);
    } catch (err) {
      this.logger.error(`Document ${documentId} failed: ${err.message}`);
      await this.updateStatus(documentId, 'error', err.message.slice(0, 500));
    }
  }

  // ── Vector Search ─────────────────────────────────────────────────────────

  async searchDocumentChunks(userQuery, documentIds, userId, topK = 10) {
    if (!documentIds || documentIds.length === 0) return [];
    const queryEmbedding = await this.vectorStoreService.generateEmbedding(userQuery);
    return this._vectorSearch(queryEmbedding, documentIds, userId, topK, null);
  }

  async searchDocumentChunksByEmbedding(embedding, documentIds, userId, topK, contentTypeFilter) {
    return this._vectorSearch(embedding, documentIds, userId, topK, contentTypeFilter);
  }

  async getChunksForSection(documentId, userId, sectionHeading, limit = 40) {
    const result = await this.pool.query(
      `SELECT dc.*, d.name AS document_name
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.document_id = $1
         AND dc.user_id = $2
         AND dc.section_heading = $3
       ORDER BY dc.chunk_index
       LIMIT $4`,
      [documentId, userId, sectionHeading, limit],
    );
    return result.rows;
  }

  async getDiverseChunks(documentIds, userId, targetChunks = 20) {
    // Sample chunks evenly across page_number range for broad document coverage
    const result = await this.pool.query(
      `WITH ranked AS (
         SELECT dc.*,
                d.name AS document_name,
                ROW_NUMBER() OVER (
                  PARTITION BY dc.document_id
                  ORDER BY dc.page_number NULLS LAST, dc.chunk_index
                ) AS rn,
                COUNT(*) OVER (PARTITION BY dc.document_id) AS total
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id
         WHERE dc.document_id = ANY($1::int[])
           AND dc.user_id = $2
       )
       SELECT * FROM ranked
       WHERE rn = 1
          OR rn = total
          OR (rn % GREATEST(1, (total / $3)::int) = 0)
       ORDER BY document_id, chunk_index
       LIMIT $3`,
      [documentIds, userId, targetChunks],
    );
    return result.rows;
  }

  async generateEmbedding(text) {
    return this.vectorStoreService.generateEmbedding(text);
  }

  /**
   * PostgreSQL full-text keyword search over chunk content.
   * Complements vector search by finding exact term matches that semantic search
   * may rank low (precise statistics, proper nouns, quoted phrases, codes).
   * Returns [] gracefully if the query produces no FTS tokens or the search fails.
   */
  async keywordSearchDocumentChunks(query, documentIds, userId, topK = 12) {
    if (!documentIds || documentIds.length === 0) return [];
    try {
      const result = await this.pool.query(
        `SELECT dc.*, d.name AS document_name,
                ts_rank_cd(
                  to_tsvector('english', dc.content),
                  plainto_tsquery('english', $1)
                ) AS similarity_score
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id
         WHERE dc.document_id = ANY($2::int[])
           AND dc.user_id = $3
           AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', $1)
         ORDER BY similarity_score DESC
         LIMIT $4`,
        [query, documentIds, userId, topK],
      );
      return result.rows;
    } catch (err) {
      // Graceful degradation — FTS is additive; a failure should not break the chat
      this.logger.warn(`Keyword search skipped: ${err.message}`);
      return [];
    }
  }

  /**
   * Retrieves chunks whose section_heading matches any of the given keyword
   * patterns (ILIKE '%pattern%').  Used for explicit section/chapter references
   * like "chapter 2" or "section 3.1" in the user's question.
   * Returns [] gracefully on failure.
   */
  async searchChunksByHeadingPatterns(documentIds, userId, patterns, limit = 20) {
    if (!documentIds?.length || !patterns?.length) return [];
    try {
      // Build one ILIKE clause per pattern; parameters start at $4
      const conditions = patterns.map((_, i) => `dc.section_heading ILIKE $${i + 4}`);
      const params = [documentIds, userId, limit, ...patterns.map((p) => `%${p}%`)];
      const result = await this.pool.query(
        `SELECT dc.*, d.name AS document_name
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id
         WHERE dc.document_id = ANY($1::int[])
           AND dc.user_id = $2
           AND (${conditions.join(' OR ')})
         ORDER BY dc.document_id, dc.chunk_index
         LIMIT $3`,
        params,
      );
      return result.rows;
    } catch (err) {
      this.logger.warn(`Section heading search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Returns all chunks whose page_number falls within [startPage, endPage]
   * across the given documents. Used for page-specific queries like "explain page 25".
   */
  async getChunksByPageRange(documentIds, userId, startPage, endPage, limit = 20) {
    if (!documentIds || documentIds.length === 0) return [];
    const result = await this.pool.query(
      `SELECT dc.*, d.name AS document_name
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.document_id = ANY($1::int[])
         AND dc.user_id = $2
         AND dc.page_number >= $3
         AND dc.page_number <= $4
       ORDER BY dc.document_id, dc.page_number, dc.chunk_index
       LIMIT $5`,
      [documentIds, userId, startPage, endPage, limit],
    );
    return result.rows;
  }

  async _vectorSearch(embedding, documentIds, userId, topK, contentTypeFilter) {
    const typeClause = contentTypeFilter
      ? `AND dc.content_type = ANY($5::varchar[])`
      : '';
    const params = contentTypeFilter
      ? [JSON.stringify(embedding), documentIds, userId, topK, contentTypeFilter]
      : [JSON.stringify(embedding), documentIds, userId, topK];

    const result = await this.pool.query(
      `SELECT
         dc.id, dc.document_id, dc.chunk_index, dc.content,
         dc.page_number, dc.section_heading, dc.content_type, dc.metadata,
         d.name AS document_name,
         1 - (dc.embedding <=> $1::vector) AS similarity_score
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.document_id = ANY($2::int[])
         AND dc.user_id = $3
         ${typeClause}
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $4`,
      params,
    );
    return result.rows;
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [ConfigService, DocumentProcessorService, VectorStoreService],
  DocumentsService,
);
