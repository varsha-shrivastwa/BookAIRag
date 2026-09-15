import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BooksService } from '../books/books.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { RAG_SYSTEM_PROMPT } from './prompts/recommendation.prompt';

@Injectable()
export class RagService {
  constructor(configService, booksService, vectorStoreService) {
    this.configService = configService;
    this.booksService = booksService;
    this.vectorStoreService = vectorStoreService;
    this.logger = new Logger(RagService.name);

    const apiKey = this.configService.get('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.llmModel = this.configService.get('LLM_MODEL') || 'gemini-3.6-flash';
  }

  async _retrieveAndBuildContext(userQuery, limit = 5) {
    const freshBooks = await this.booksService.searchCatalog(userQuery, limit);

    for (const book of freshBooks) {
      if (book.description && book.description.length > 20) {
        const textContent = this.booksService.createSemanticText(book);
        const embedding = await this.vectorStoreService.generateEmbedding(textContent);
        await this.vectorStoreService.storeBookEmbedding(book, textContent, embedding);
      }
    }

    const queryEmbedding = await this.vectorStoreService.generateEmbedding(userQuery);
    let relevantBooks = await this.vectorStoreService.searchSimilarBooks(queryEmbedding, limit);
    if (!relevantBooks || relevantBooks.length === 0) relevantBooks = freshBooks;

    const contextString = relevantBooks
      .map(
        (b, i) =>
          `[Book ${i + 1}]\nTitle: ${b.title}\nAuthors: ${Array.isArray(b.authors) ? b.authors.join(', ') : b.authors}\nCategories: ${Array.isArray(b.categories) ? b.categories.join(', ') : b.categories}\nDescription: ${b.description}`,
      )
      .join('\n\n');

    const formattedPrompt = RAG_SYSTEM_PROMPT
      .replace('{context}', contextString)
      .replace('{userQuery}', userQuery);

    const mappedBooks = relevantBooks.map((b) => ({
      id: b.google_book_id || b.googleBookId || b.id,
      title: b.title,
      authors: Array.isArray(b.authors) ? b.authors : [b.authors],
      description: b.description,
      categories: Array.isArray(b.categories) ? b.categories : [b.categories],
      thumbnail: b.thumbnail,
      infoLink: b.info_link || b.infoLink,
      publisher: b.publisher,
      publishedDate: b.published_date || b.publishedDate,
    }));

    return { formattedPrompt, mappedBooks };
  }

  _toGeminiContents(history, userQuery) {
    const sanitizedHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      : [];
    return [...sanitizedHistory, { role: 'user', parts: [{ text: userQuery }] }];
  }

  async generateRecommendation(userQuery, history = [], limit = 5) {
    const { formattedPrompt, mappedBooks } = await this._retrieveAndBuildContext(userQuery, limit);
    const contents = this._toGeminiContents(history, userQuery);

    let aiMessage = '';
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.llmModel,
        systemInstruction: formattedPrompt,
      });
      const result = await model.generateContent({ contents });
      aiMessage = result.response.text() || 'Here are some great book recommendations!';
    } catch (error) {
      this.logger.warn(`Gemini call failed (fallback): ${error.message}`);
      aiMessage = `Based on your request for "${userQuery}", here are curated recommendations:`;
    }

    return { reply: aiMessage, recommendedBooks: mappedBooks };
  }

  async *streamRecommendation(userQuery, history = [], limit = 5) {
    const { formattedPrompt, mappedBooks } = await this._retrieveAndBuildContext(userQuery, limit);
    const contents = this._toGeminiContents(history, userQuery);

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.llmModel,
        systemInstruction: formattedPrompt,
      });
      const streamResult = await model.generateContentStream({ contents });
      for await (const chunk of streamResult.stream) {
        const text = chunk.text();
        if (text) yield { type: 'chunk', content: text };
      }
    } catch (error) {
      this.logger.warn(`Gemini streaming failed (fallback): ${error.message}`);
      yield { type: 'chunk', content: `Based on your request for "${userQuery}", here are curated recommendations:` };
    }

    yield { type: 'books', books: mappedBooks };
  }
}

Reflect.defineMetadata('design:paramtypes', [ConfigService, BooksService, VectorStoreService], RagService);
