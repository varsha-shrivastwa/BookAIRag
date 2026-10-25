import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import { pathToFileURL } from 'url';

// Use native dynamic import to bypass SWC's require() transformation for ESM modules
const nativeImport = new Function('specifier', 'return import(specifier)');

// Singleton pdfjs reference — loaded once per process
let _pdfjsLib = null;

const CMAP_URL = pathToFileURL(
  path.resolve(path.dirname(require.resolve('pdfjs-dist/package.json')), 'cmaps') + '/',
).href;

const FONT_URL = pathToFileURL(
  path.resolve(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/',
).href;

const WORKER_URL = pathToFileURL(
  path.resolve(path.dirname(require.resolve('pdfjs-dist/package.json')), 'legacy/build/pdf.worker.mjs'),
).href;

// How many text items qualify a page as "has text"
const MIN_TEXT_ITEMS_THRESHOLD = 8;

@Injectable()
export class PdfRendererService {
  constructor(configService) {
    this.configService = configService;
    this.logger = new Logger(PdfRendererService.name);
  }

  async _getPdfJs() {
    if (_pdfjsLib) return _pdfjsLib;
    const pdfjs = await nativeImport('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
    _pdfjsLib = pdfjs;
    this.logger.log(`pdfjs-dist ${pdfjs.version} initialized`);
    return pdfjs;
  }

  async _loadDocument(buffer) {
    const pdfjs = await this._getPdfJs();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: FONT_URL,
      useWorkerFetch: false,
      isEvalSupported: false,
      verbosity: 0, // suppress console warnings
    });
    return loadingTask.promise;
  }

  async getPageCount(buffer) {
    const doc = await this._loadDocument(buffer);
    const count = doc.numPages;
    await doc.loadingTask.destroy();
    return count;
  }

  /**
   * Extract text items from a single page.
   * Returns { items, medianFontSize, viewport }
   */
  async getPageTextData(buffer, pageNumber) {
    const doc = await this._loadDocument(buffer);
    try {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent({ includeMarkedContent: false });

      const items = textContent.items
        .filter((item) => item.str && item.str.trim())
        .map((item) => ({
          str: item.str,
          // transform[0] = scaleX ≈ font size, transform[4] = x, transform[5] = y
          fontSize: Math.abs(item.transform[0]),
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          hasEOL: item.hasEOL,
        }));

      const fontSizes = items.map((i) => i.fontSize).filter((f) => f > 0).sort((a, b) => a - b);
      const median = fontSizes[Math.floor(fontSizes.length / 2)] || 12;

      page.cleanup();
      return { items, medianFontSize: median, viewport };
    } finally {
      await doc.loadingTask.destroy();
    }
  }

  /**
   * Classify a page as 'text', 'mixed', 'scanned', or 'blank'.
   * Uses both text item count and operator list analysis.
   */
  async classifyPage(buffer, pageNumber) {
    const doc = await this._loadDocument(buffer);
    try {
      const page = await doc.getPage(pageNumber);

      const [textContent, opList] = await Promise.all([
        page.getTextContent({ includeMarkedContent: false }),
        page.getOperatorList(),
      ]);

      const textItems = textContent.items.filter((i) => i.str && i.str.trim().length > 0);
      const hasText = textItems.length >= MIN_TEXT_ITEMS_THRESHOLD;

      // Check for image paint operators (OPS enum values for image rendering)
      // paintImageXObject=85, paintInlineImageXObject=86, paintJpegXObject (varies)
      const imageOps = new Set([85, 86, 82, 83]);
      const hasImages = opList.fnArray.some((fn) => imageOps.has(fn));

      page.cleanup();

      if (!hasText && !hasImages) return 'blank';
      if (!hasText && hasImages) return 'scanned';
      if (hasText && hasImages) return 'mixed';
      return 'text';
    } finally {
      await doc.loadingTask.destroy();
    }
  }

  /**
   * Render a PDF page to a JPEG buffer.
   * scale=1.5 for normal pages, 2.0 for scanned pages.
   */
  async renderPageToJpeg(buffer, pageNumber, scale = 1.5) {
    const { createCanvas } = require('@napi-rs/canvas');
    const doc = await this._loadDocument(buffer);
    try {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpegBuffer = await canvas.encode('jpeg', 80);

      page.cleanup();
      return jpegBuffer;
    } finally {
      await doc.loadingTask.destroy();
    }
  }
}

Reflect.defineMetadata('design:paramtypes', [ConfigService], PdfRendererService);
