import {
  Controller, Post, Get, Delete,
  Param, Req, Res, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, BadRequestException, PayloadTooLargeException, ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { DocumentsService } from './documents.service.js';
import { AuthService } from '../auth/auth.service.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Allowed file extensions — must match the MIME allowlist in document-processor.service.js
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md', '.xlsx', '.xls', '.csv']);

/** Strip path separators, control characters, and null bytes from filenames. */
function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'document';
  return name
    .replace(/\0/g, '')                    // null bytes
    .replace(/[/\\:*?"<>|]/g, '_')         // path/shell unsafe chars
    .replace(/[\x00-\x1f\x7f]/g, '')       // control characters
    .trim()
    .slice(0, 255) || 'document';
}

const STAGE_MESSAGES = {
  uploading:  'Uploading document',
  extracting: 'Extracting content',
  analyzing:  'Analyzing structure',
  indexing:   'Indexing document',
  ready:      'Document ready',
  error:      'Processing failed',
};

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(documentsService, authService) {
    this.documentsService = documentsService;
    this.authService = authService;
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard)
  // More restrictive than the global throttler: max 10 uploads per 15 minutes per IP.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @UseInterceptors(FileInterceptor('file', { storage: undefined, limits: { fileSize: MAX_FILE_SIZE } }))
  @ApiOperation({ summary: 'Upload a document for RAG processing' })
  @ApiConsumes('multipart/form-data')
  async uploadDocument(@UploadedFile() file, @Req() req) {
    if (!file) throw new BadRequestException('No file provided. Send multipart/form-data with a "file" field.');
    if (file.size === 0) throw new BadRequestException('Uploaded file is empty.');
    if (file.size > MAX_FILE_SIZE) throw new PayloadTooLargeException('File exceeds the 20 MB limit.');

    // Validate file extension against the allowlist (defence-in-depth alongside MIME check)
    const originalName = file.originalname || '';
    const dotIdx = originalName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? originalName.slice(dotIdx).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        `File extension "${ext}" is not allowed. Supported: PDF, DOCX, TXT, MD, XLSX, CSV.`,
      );
    }

    const safeName = sanitizeFilename(file.originalname);
    const userId = req.user.sub;

    // Create DB record
    const doc = await this.documentsService.createDocument(userId, safeName, file.size, file.mimetype);

    // Persist the buffer to disk for retry capability
    const filePath = await this.documentsService.saveUploadedFile(doc.id, file.buffer);
    await this.documentsService.updateFilePath(doc.id, filePath);

    // Fire-and-forget processing
    this.documentsService
      .processDocument(doc.id, userId, file.buffer, file.mimetype, safeName)
      .catch(() => {});

    return { documentId: doc.id, name: doc.name, sizeBytes: doc.size_bytes, status: 'uploading' };
  }

  // ── Upload Progress (SSE) ──────────────────────────────────────────────────

  @Get('upload/progress/:id')
  @ApiOperation({ summary: 'Stream document processing progress (SSE). Auth via ?token=JWT' })
  async getUploadProgress(@Param('id', ParseIntPipe) id, @Req() req, @Res() res) {
    const token = req.query.token;
    if (!token) { res.status(401).json({ message: 'Missing token' }); return; }

    let userId;
    try {
      userId = this.authService.verifyToken(token).sub;
    } catch {
      res.status(401).json({ message: 'Invalid or expired token' }); return;
    }

    const doc = await this.documentsService.getDocument(id);
    if (!doc || doc.user_id !== userId) { res.status(404).json({ message: 'Not found' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const TERMINAL = new Set(['ready', 'error']);
    let lastStatus  = null;
    let lastIndexed = 0;

    const interval = setInterval(async () => {
      try {
        const current = await this.documentsService.getDocument(id);
        if (!current) { clearInterval(interval); res.end(); return; }

        // Compute stage-specific progress so the frontend can show a percentage.
        const isIndexing   = current.status === 'indexing';
        const isExtracting = current.status === 'extracting';

        const totalChunks = isIndexing  ? (current.chunk_count    || 0) : 0;
        const doneChunks  = isIndexing  ? (current.indexed_chunks  || 0) : 0;
        const totalPages  = isExtracting ? (current.total_pages    || 0) : 0;
        const donePages   = isExtracting ? (current.extracted_pages || 0) : 0;

        const progress = isIndexing && totalChunks > 0
          ? Math.round((doneChunks  / totalChunks) * 100)
          : isExtracting && totalPages > 0
            ? Math.round((donePages / totalPages) * 100)
            : null;

        // Emit on status change OR whenever progress advances.
        const progressChanged = (isIndexing && doneChunks !== lastIndexed)
          || (isExtracting && donePages !== lastIndexed);

        if (current.status !== lastStatus || progressChanged) {
          lastStatus  = current.status;
          lastIndexed = isIndexing ? doneChunks : donePages;

          const message = isIndexing && totalChunks > 0
            ? `Indexing: ${doneChunks} / ${totalChunks} chunks`
            : isExtracting && totalPages > 0
              ? `Extracting page ${donePages} / ${totalPages}`
              : (STAGE_MESSAGES[current.status] || current.status);

          send({
            type: 'progress',
            stage: current.status,
            message,
            documentId: id,
            ...(progress !== null && {
              progress,
              ...(isIndexing   && { indexedChunks: doneChunks, totalChunks }),
              ...(isExtracting && { extractedPages: donePages, totalPages }),
            }),
            ...(current.status === 'error' && { error: current.error_message }),
          });
        }

        if (TERMINAL.has(current.status)) {
          if (current.status === 'ready') {
            send({
              type: 'done', documentId: id, name: current.name,
              sizeBytes: current.size_bytes, mimeType: current.mime_type,
              chunkCount: current.chunk_count, status: 'ready',
              canRetry: false,
            });
          } else if (current.status === 'error') {
            send({
              type: 'error_done', documentId: id, status: 'error',
              error: current.error_message,
              canRetry: !!current.file_path && (current.retry_count || 0) < 3,
              retryCount: current.retry_count || 0,
            });
          }
          clearInterval(interval);
          res.end();
        }
      } catch {
        send({ type: 'error', message: 'Progress check failed' });
        clearInterval(interval);
        res.end();
      }
    }, 600);

    req.on('close', () => clearInterval(interval));
  }

  // ── Retry Failed Document ──────────────────────────────────────────────────

  @Post(':id/retry')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Retry processing a failed document' })
  async retryDocument(@Param('id', ParseIntPipe) id, @Req() req) {
    return this.documentsService.retryDocument(id, req.user.sub);
  }

  // ── List Documents ─────────────────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List all documents for the authenticated user' })
  async listDocuments(@Req() req) {
    const docs = await this.documentsService.getUserDocuments(req.user.sub);
    return docs.map((d) => ({
      id:           d.id,
      name:         d.name,
      sizeBytes:    d.size_bytes,
      mimeType:     d.mime_type,
      status:       d.status,
      errorMessage: d.error_message,
      chunkCount:   d.chunk_count,
      createdAt:    d.created_at,
      canRetry:     d.status === 'error' && !!d.file_path && (d.retry_count || 0) < 3,
      retryCount:   d.retry_count || 0,
    }));
  }

  // ── Document Sections ──────────────────────────────────────────────────────

  @Get(':id/sections')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List all sections (headings) found in a document' })
  async getDocumentSections(@Param('id', ParseIntPipe) id, @Req() req) {
    return this.documentsService.getDocumentSections(id, req.user.sub);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a document and all its indexed chunks' })
  async deleteDocument(@Param('id', ParseIntPipe) id, @Req() req) {
    await this.documentsService.deleteDocument(id, req.user.sub);
    return { success: true };
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [DocumentsService, AuthService],
  DocumentsController,
);
