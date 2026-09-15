import { Injectable } from '@nestjs/common';
import { GoogleBooksClient } from './google-books.client';

@Injectable()
export class BooksService {
  constructor(googleBooksClient) {
    this.googleBooksClient = googleBooksClient;
  }

  async searchCatalog(query, limit = 10, startIndex = 0) {
    return await this.googleBooksClient.searchBooks(query, limit, startIndex);
  }

  createSemanticText(book) {
    const authors = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
    const categories = Array.isArray(book.categories) ? book.categories.join(', ') : book.categories;
    return `Title: ${book.title}\nAuthors: ${authors}\nCategories/Genres: ${categories}\nDescription: ${book.description}`;
  }
}

Reflect.defineMetadata('design:paramtypes', [GoogleBooksClient], BooksService);
