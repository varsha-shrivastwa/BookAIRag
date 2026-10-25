import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/ai.service.js';

// Simple concurrency limiter — replaces ESM-only p-limit
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
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

const VISION_CONCURRENCY = 3;
const MAX_RETRIES = 3;

const EXTRACTION_PROMPT = `You are a precise document extraction assistant. Analyze this document page image and respond ONLY with a valid JSON object. Do not include any text, markdown, or explanation outside the JSON.

Extract all content from the page using this exact schema:
{
  "page_type": "scanned_text|chart|diagram|table_image|mixed|photo|text",
  "ocr_text": "all readable text on the page, preserving paragraphs with newlines, empty string if none",
  "tables": [
    {
      "caption": "table title or nearby heading, empty string if none",
      "markdown": "| Header1 | Header2 |\\n|---|---|\\n| val | val |"
    }
  ],
  "visuals": [
    {
      "type": "bar_chart|line_chart|pie_chart|scatter_plot|flowchart|diagram|image|other",
      "title": "chart or figure title, empty string if none",
      "description": "1-3 sentence plain-English description of what this visual shows",
      "x_axis_label": "x-axis label or empty string",
      "y_axis_label": "y-axis label or empty string",
      "data_summary": "key data points, values, trends as plain text, empty string if not applicable",
      "legend_items": []
    }
  ],
  "reading_confidence": 0.95
}

Rules:
- ocr_text must include ALL readable text on the page, including headers, footers, captions
- For tables, generate proper Markdown pipe-table format with alignment rows
- For charts/graphs, extract specific numbers and trends from the axes/labels/data points if visible
- reading_confidence: 1.0 = crystal clear, 0.5 = somewhat unclear, 0.0 = unreadable
- Return ONLY the JSON object, nothing else`;

@Injectable()
export class VisionExtractorService {
  constructor(configService, aiService) {
    this.configService = configService;
    this.aiService = aiService;
    this.logger = new Logger(VisionExtractorService.name);
    this.limit = createLimit(VISION_CONCURRENCY);
  }

  /**
   * Analyze a single page image buffer.
   * Returns a structured VisionPageResult or null on failure.
   */
  async analyzePageImage(jpegBuffer, pageNumber) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const responseText = (await this.aiService.analyzeImage(jpegBuffer, EXTRACTION_PROMPT)).trim();
        return this._parseVisionResponse(responseText, pageNumber);
      } catch (err) {
        const isRateLimit = err.message?.includes('429') || err.status === 429;
        if (isRateLimit && attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          this.logger.warn(`Rate limit on page ${pageNumber}, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        this.logger.warn(`Vision extraction failed for page ${pageNumber}: ${err.message?.slice(0, 120)}`);
        return this._emptyResult();
      }
    }
    return this._emptyResult();
  }

  /**
   * Analyze multiple page images concurrently (bounded by concurrency limit).
   * pageImages: Array<{ jpegBuffer, pageNumber }>
   * Returns Array<VisionPageResult> in the same order.
   */
  async batchAnalyzePages(pageImages) {
    const tasks = pageImages.map(({ jpegBuffer, pageNumber }) =>
      this.limit(() => this.analyzePageImage(jpegBuffer, pageNumber)),
    );
    const results = await Promise.allSettled(tasks);
    return results.map((r) => (r.status === 'fulfilled' ? r.value : this._emptyResult()));
  }

  _parseVisionResponse(text, pageNumber) {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { /* fall through */ }
      }
      this.logger.debug(`JSON parse failed for page ${pageNumber}, treating as plain text`);
      return {
        page_type: 'scanned_text',
        ocr_text: text,
        tables: [],
        visuals: [],
        reading_confidence: 0.4,
      };
    }
  }

  _emptyResult() {
    return {
      page_type: 'text',
      ocr_text: '',
      tables: [],
      visuals: [],
      reading_confidence: 0,
    };
  }
}

Reflect.defineMetadata('design:paramtypes', [ConfigService, AiService], VisionExtractorService);
