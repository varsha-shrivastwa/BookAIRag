import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BOOK_EMBEDDINGS_TABLE_SCHEMA } from './entities/book-embedding.schema';

@Injectable()
export class VectorStoreService {
  constructor(configService) {
    this.configService = configService;
    this.logger = new Logger(VectorStoreService.name);

    const connectionString =
      this.configService.get('DATABASE_URL') ||
      'postgresql://raguser:ragpass@localhost:5432/book_rag_db';
    this.pool = new Pool({ connectionString });

    const apiKey = this.configService.get('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = this.configService.get('EMBEDDING_MODEL') || 'gemini-embedding-001';
  }

  async onModuleInit() {
    try {
      await this.pool.query(BOOK_EMBEDDINGS_TABLE_SCHEMA);
      this.logger.log('PostgreSQL pgvector extension & table initialized.');
    } catch (error) {
      this.logger.warn(`Could not initialize pgvector table: ${error.message}`);
    }
  }

  async generateEmbedding(text) {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
      const result = await model.embedContent(text.replace(/\n/g, ' '));
      return result.embedding.values;
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${error.message}`);
      return new Array(768).fill(0);
    }
  }

  async storeBookEmbedding(book, textContent, embedding) {
    const query = `
      INSERT INTO book_embeddings
        (google_book_id, title, authors, categories, description, thumbnail, info_link, embedding)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
      ON CONFLICT (google_book_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        embedding = EXCLUDED.embedding
      RETURNING id;
    `;
    const values = [
      book.googleBookId, book.title, book.authors, book.categories,
      book.description, book.thumbnail, book.infoLink, JSON.stringify(embedding),
    ];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async searchSimilarBooks(queryEmbedding, topK = 5) {
    try {
      const query = `
        SELECT id, google_book_id, title, authors, categories, description, thumbnail, info_link,
               1 - (embedding <=> $1::vector) AS similarity_score
        FROM book_embeddings
        ORDER BY embedding <=> $1::vector
        LIMIT $2;
      `;
      const result = await this.pool.query(query, [JSON.stringify(queryEmbedding), topK]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Vector search failed: ${error.message}`);
      return [];
    }
  }
}

Reflect.defineMetadata('design:paramtypes', [ConfigService], VectorStoreService);
