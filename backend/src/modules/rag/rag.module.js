import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { BooksModule } from '../books/books.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [BooksModule, VectorStoreModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
