import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { VectorStoreModule } from '../vector-store/vector-store.module.js';
import { DocumentsService } from './documents.service.js';
import { DocumentProcessorService } from './document-processor.service.js';
import { DocChatService } from './doc-chat.service.js';
import { PdfRendererService } from './extraction/pdf-renderer.service.js';
import { VisionExtractorService } from './extraction/vision-extractor.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocChatController } from './doc-chat.controller.js';

@Module({
  imports: [AuthModule, VectorStoreModule],
  providers: [
    PdfRendererService,
    VisionExtractorService,
    DocumentProcessorService,
    DocChatService,
    DocumentsService,
  ],
  controllers: [DocumentsController, DocChatController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
