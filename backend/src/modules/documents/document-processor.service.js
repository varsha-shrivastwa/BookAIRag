import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PdfRendererService } from './extraction/pdf-renderer.service.js';
import { VisionExtractorService } from './extraction/vision-extractor.service.js';
import {
  buildTextPageElements,
  buildVisionPageElements,
  buildDocxElements,
  buildSpreadsheetElements,
  buildPlainTextElements,
} from './extraction/document-element-builder.js';

// ── Bounded concurrency helper ────────────────────────────────────────────────
function createLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active < concurrency && queue.length) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve, reject).finally(() => { active--; next(); });
    }
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

// Limit parallel page renders to avoid flooding memory on large PDFs
const renderLimit = createLimit(4);

// ── Config ────────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 1400;
const OVERLAP    = 200;
const MIN_CHUNK  = 80;
// Raised from 700 → 2500 so large documents (300+ pages) are fully indexed
// rather than silently truncated at 40–50% of content.
const MAX_CHUNKS = 2500;

// Pages with fewer chars than this trigger vision processing for OCR
const LOW_TEXT_THRESHOLD = 120;
// Maximum pages to process at full quality before downsampling scale
const LARGE_DOC_THRESHOLD = 150;

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

// Expected leading bytes for binary formats. Text formats (TXT/MD/CSV) have no
// fixed magic bytes so they are omitted — UTF-8 validity is checked separately.
const MAGIC_BYTES = {
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK ZIP
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK ZIP
  'application/vnd.ms-excel': Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK ZIP
};

@Injectable()
export class DocumentProcessorService {
  constructor(configService, pdfRendererService, visionExtractorService) {
    this.configService = configService;
    this.pdfRendererService = pdfRendererService;
    this.visionExtractorService = visionExtractorService;
    this.logger = new Logger(DocumentProcessorService.name);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  resolveMimeType(mimeType, originalName) {
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (originalName?.endsWith('.md'))   return 'text/markdown';
      if (originalName?.endsWith('.txt'))  return 'text/plain';
      if (originalName?.endsWith('.csv'))  return 'text/csv';
    }
    if (mimeType === 'text/plain' && originalName?.endsWith('.md')) return 'text/markdown';
    if (!ALLOWED_MIMES.has(mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: "${mimeType}". Supported: PDF, DOCX, TXT, MD, XLSX, CSV.`,
      );
    }
    return mimeType;
  }

  /**
   * Verify the file buffer starts with the expected magic bytes for the given
   * MIME type. Rejects files where the content does not match the declared
   * type (e.g., a script renamed to .pdf). Text formats have no magic bytes
   * and are validated by checking for valid UTF-8 instead.
   */
  validateFileBytes(buffer, mimeType) {
    const magic = MAGIC_BYTES[mimeType];
    if (magic) {
      if (buffer.length < magic.length) {
        throw new BadRequestException('Uploaded file is too short to be a valid document.');
      }
      if (!buffer.slice(0, magic.length).equals(magic)) {
        throw new BadRequestException(
          'File content does not match its declared type. Upload a valid, non-corrupted file.',
        );
      }
    } else {
      // Text-based formats: verify the buffer is valid UTF-8
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        throw new BadRequestException(
          'Text file contains invalid characters. Ensure the file is UTF-8 encoded.',
        );
      }
    }
  }

  /**
   * Extract structured elements from the document buffer.
   * Returns DocumentElement[] ordered as they appear in the document.
   * onProgress(extractedPages, totalPages) is called periodically during PDF extraction.
   */
  async extract(buffer, mimeType, originalName, onProgress) {
    const resolved = this.resolveMimeType(mimeType, originalName);
    this.validateFileBytes(buffer, resolved);
    this.logger.log(`Extracting: ${originalName} (${resolved})`);

    if (resolved === 'application/pdf') {
      return this._extractPdf(buffer, originalName, onProgress);
    }
    if (resolved === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this._extractDocx(buffer);
    }
    if (resolved === 'text/plain' || resolved === 'text/markdown') {
      const text = buffer.toString('utf-8');
      return buildPlainTextElements(text);
    }
    // XLSX / CSV / Excel
    return buildSpreadsheetElements(buffer, resolved);
  }

  /**
   * Chunk structured elements into indexable records with metadata.
   * Returns ChunkRecord[] = { content, pageNumber, sectionHeading, contentType, metadata }
   */
  chunkElements(elements) {
    const chunks = [];
    let textBuffer = '';
    let bufferPage = null;
    let bufferSection = '';

    const flushText = () => {
      if (textBuffer.trim().length < MIN_CHUNK) { textBuffer = ''; return; }
      // Slide the text buffer into CHUNK_SIZE chunks with OVERLAP
      let start = 0;
      const text = textBuffer.trim();
      while (start < text.length && chunks.length < MAX_CHUNKS) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        const slice = text.slice(start, end).trim();
        if (slice.length >= MIN_CHUNK) {
          chunks.push({
            content: slice,
            pageNumber: bufferPage,
            sectionHeading: bufferSection || null,
            contentType: 'text',
            metadata: {},
          });
        }
        if (end >= text.length) break;
        start = Math.max(end - OVERLAP, start + 1);
      }
      textBuffer = textBuffer.slice(-OVERLAP); // keep overlap tail for next segment
    };

    for (const el of elements) {
      // Update running context
      if (el.pageNumber !== null && el.pageNumber !== undefined) {
        if (bufferPage !== el.pageNumber) {
          // Page changed — flush and reset
          flushText();
          textBuffer = '';
          bufferPage = el.pageNumber;
        }
      }
      if (el.type === 'heading') {
        bufferSection = el.content;
      }

      // Tables, charts, images → standalone atomic chunks
      if (el.type === 'table' || el.type === 'chart' || el.type === 'image') {
        flushText();
        textBuffer = '';

        if (chunks.length < MAX_CHUNKS && el.content.trim().length >= MIN_CHUNK) {
          chunks.push({
            content: el.content.trim(),
            pageNumber: el.pageNumber ?? null,
            sectionHeading: el.sectionHeading || null,
            contentType: el.contentType,
            metadata: el.metadata || {},
          });
        }
        continue;
      }

      // Headings: emit as their own tiny chunk so they can be retrieved independently
      if (el.type === 'heading' && el.content.length >= 20) {
        flushText();
        textBuffer = '';
        if (chunks.length < MAX_CHUNKS) {
          chunks.push({
            content: el.content,
            pageNumber: el.pageNumber ?? null,
            sectionHeading: el.sectionHeading || null,
            contentType: 'text',
            metadata: { isHeading: true },
          });
        }
        continue;
      }

      // Accumulate text (paragraphs, short headings, OCR blocks)
      if (bufferPage === null) bufferPage = el.pageNumber ?? null;
      textBuffer += (textBuffer ? '\n\n' : '') + el.content;

      // Flush if buffer is getting large
      if (textBuffer.length > CHUNK_SIZE * 1.5) {
        flushText();
      }
    }

    // Final flush
    flushText();

    return chunks;
  }

  // ── PDF Extraction ──────────────────────────────────────────────────────────

  async _extractPdf(buffer, originalName, onProgress) {
    let pageCount;
    try {
      pageCount = await this.pdfRendererService.getPageCount(buffer);
    } catch (err) {
      throw new Error(`Cannot open PDF "${originalName}": ${err.message}`);
    }

    this.logger.log(`PDF: ${pageCount} pages`);
    const elements = [];
    let currentSection = '';

    const renderScale = pageCount > LARGE_DOC_THRESHOLD ? 1.2 : 1.5;
    const cappedPages = Math.min(pageCount, MAX_CHUNKS * 4);

    // Use a virtual step counter covering the full pipeline so progress moves
    // continuously: classification (50%) + vision rendering (20%) + text extraction (30%).
    const CLASSIFY_WEIGHT = 0.50;
    const VISION_WEIGHT   = 0.20;
    const EXTRACT_WEIGHT  = 0.30;
    const totalVirtual = cappedPages;   // denominator stays page-count for readable labels

    let virtualDone = 0;
    const report = async (done, total) => onProgress?.(done, total);
    await report(0, cappedPages);

    // ── Phase 1: classify pages (50% of progress) ────────────────────────────
    const classifyBatch = 10;
    const classifications = [];
    for (let start = 1; start <= cappedPages; start += classifyBatch) {
      const end = Math.min(start + classifyBatch - 1, cappedPages);
      const batch = await Promise.all(
        Array.from({ length: end - start + 1 }, (_, i) =>
          this.pdfRendererService.classifyPage(buffer, start + i).catch(() => 'text'),
        ),
      );
      classifications.push(...batch);

      // Advance virtual progress through the classification slice
      virtualDone = Math.round((end / cappedPages) * cappedPages * CLASSIFY_WEIGHT);
      await report(virtualDone, cappedPages);
    }

    // ── Phase 2: vision rendering + OCR (20% of progress) ───────────────────
    const visionPageNums = classifications
      .map((c, i) => (c === 'scanned' || c === 'mixed') ? i + 1 : null)
      .filter(Boolean);

    const visionResults = new Map();
    if (visionPageNums.length > 0) {
      this.logger.log(`Running vision extraction on ${visionPageNums.length} pages`);
      let visionDone = 0;
      const classifyEnd = virtualDone;

      // Render + analyze each page together in one bounded task (concurrency 3).
      // This eliminates the previous two-phase approach where all renders finished
      // before any AI analysis began, causing a long silent stall with no progress.
      const visionLimit = createLimit(3);
      await Promise.all(
        visionPageNums.map((pageNum) =>
          visionLimit(async () => {
            const scale = classifications[pageNum - 1] === 'scanned' ? 2.0 : renderScale;
            const jpegBuffer = await this.pdfRendererService.renderPageToJpeg(buffer, pageNum, scale);
            const result = await this.visionExtractorService.analyzePageImage(jpegBuffer, pageNum);
            visionResults.set(pageNum, result ?? this.visionExtractorService._emptyResult());

            visionDone++;
            const visionFrac = visionDone / visionPageNums.length;
            virtualDone = Math.round(classifyEnd + visionFrac * cappedPages * VISION_WEIGHT);
            await report(Math.min(virtualDone, cappedPages), cappedPages);
          }),
        ),
      );
    }

    // ── Phase 3: text extraction page-by-page (30% of progress) ─────────────
    const extractStart = virtualDone;
    for (let pageNum = 1; pageNum <= cappedPages; pageNum++) {
      const classification = classifications[pageNum - 1];

      if (classification !== 'blank') {
        if (classification === 'scanned') {
          const visionResult = visionResults.get(pageNum);
          const pageElements = buildVisionPageElements(visionResult, pageNum, currentSection);
          if (pageElements.length > 0) {
            currentSection = pageElements.find((e) => e.type === 'heading')?.content || currentSection;
            elements.push(...pageElements);
          }
        } else {
          try {
            const { items, medianFontSize } = await this.pdfRendererService.getPageTextData(buffer, pageNum);
            const textElements = buildTextPageElements(items, pageNum, medianFontSize, currentSection);
            const lastHeading = [...textElements].reverse().find((e) => e.type === 'heading');
            if (lastHeading) currentSection = lastHeading.content;
            elements.push(...textElements);

            if (classification === 'mixed') {
              const visionResult = visionResults.get(pageNum);
              if (visionResult) {
                const visionElements = buildVisionPageElements(
                  { ...visionResult, ocr_text: '' },
                  pageNum, currentSection,
                );
                elements.push(...visionElements.filter((e) => e.type === 'table' || e.type === 'chart' || e.type === 'image'));
              }
            }
          } catch (err) {
            this.logger.warn(`Page ${pageNum} text extraction failed: ${err.message}`);
          }
        }
      }

      // Report every 5 pages during extraction phase
      if (pageNum % 5 === 0 || pageNum === cappedPages) {
        const extractFrac = pageNum / cappedPages;
        virtualDone = Math.round(extractStart + extractFrac * cappedPages * EXTRACT_WEIGHT);
        await report(Math.min(virtualDone, cappedPages), cappedPages);
      }
    }

    if (pageCount > cappedPages) {
      this.logger.warn(`Document truncated: processed ${cappedPages} of ${pageCount} pages (cap reached)`);
    }

    return elements;
  }

  // ── DOCX Extraction ─────────────────────────────────────────────────────────

  async _extractDocx(buffer) {
    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ buffer });
    if (!result.value) return [];
    return buildDocxElements(result.value);
  }
}

Reflect.defineMetadata(
  'design:paramtypes',
  [ConfigService, PdfRendererService, VisionExtractorService],
  DocumentProcessorService,
);
