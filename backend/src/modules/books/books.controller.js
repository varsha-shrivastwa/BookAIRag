import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BooksService } from './books.service';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(booksService) {
    this.booksService = booksService;
  }

  @Get('search')
  @ApiOperation({ summary: 'Search the Google Books catalog with pagination' })
  @ApiQuery({ name: 'q',     required: true,  description: 'Search query' })
  @ApiQuery({ name: 'page',  required: false,  description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false,  description: 'Results per page (max 40)', example: 10 })
  async search(
    @Query('q') q,
    @Query('page') page,
    @Query('limit') limit,
  ) {
    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(40, Math.max(1, parseInt(limit, 10) || 10));
    const books = await this.booksService.searchCatalog(q || '', limitNum, (pageNum - 1) * limitNum);
    return { page: pageNum, limit: limitNum, results: books };
  }
}

Reflect.defineMetadata('design:paramtypes', [BooksService], BooksController);
