import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { GoogleBooksClient } from './google-books.client';

@Module({
  controllers: [BooksController],
  providers: [GoogleBooksClient, BooksService],
  exports: [BooksService, GoogleBooksClient],
})
export class BooksModule {}
