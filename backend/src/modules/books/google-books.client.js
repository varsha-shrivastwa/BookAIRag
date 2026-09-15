import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GoogleBooksClient {
  constructor(configService) {
    this.configService = configService;
    this.baseUrl = 'https://www.googleapis.com/books/v1/volumes';
    this.logger = new Logger(GoogleBooksClient.name);
  }

  /**
   * Search Google Books API by query term or topic
   * @param {string} query
   * @param {number} maxResults
   * @param {number} startIndex  Offset for pagination (0-based)
   */
  async searchBooks(query, maxResults = 10, startIndex = 0) {
    try {
      const apiKey = this.configService.get('GOOGLE_BOOKS_API_KEY');
      const params = { q: query, maxResults, startIndex, printType: 'books' };
      if (apiKey) params.key = apiKey;

      const response = await axios.get(this.baseUrl, { params });
      return (response.data.items || []).map((item) => this.formatBookMetadata(item));
    } catch (error) {
      this.logger.error(`Google Books API fetch failed: ${error.message}`);
      return [];
    }
  }

  formatBookMetadata(item) {
    const info = item.volumeInfo || {};
    return {
      googleBookId: item.id,
      title: info.title || 'Untitled',
      authors: info.authors || ['Unknown Author'],
      publisher: info.publisher || 'Unknown Publisher',
      publishedDate: info.publishedDate || '',
      description: info.description || info.subtitle || 'No description available.',
      categories: info.categories || ['General'],
      averageRating: info.averageRating || null,
      ratingsCount: info.ratingsCount || 0,
      thumbnail: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null,
      infoLink: info.infoLink || '',
    };
  }
}

// Replaces TypeScript emitDecoratorMetadata — tells NestJS DI what to inject
Reflect.defineMetadata('design:paramtypes', [ConfigService], GoogleBooksClient);
