/**
 * Builds an ordered DocumentElement[] from various document formats.
 * A DocumentElement represents one logical content unit: a heading, paragraph,
 * table, chart description, or OCR block — tagged with page/section metadata.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
// DocumentElement = {
//   type: 'heading' | 'paragraph' | 'table' | 'chart' | 'ocr_block' | 'image',
//   content: string,
//   pageNumber: number | null,
//   sectionHeading: string,
//   contentType: 'text' | 'table' | 'chart' | 'image' | 'ocr',
//   metadata: object,
// }

const HEADING_FONT_MULTIPLIER = 1.35; // font size > median * this = heading
const MIN_HEADING_LENGTH = 3;
const MAX_HEADING_LENGTH = 200;

// ── PDF Element Building ───────────────────────────────────────────────────────

/**
 * Build elements from a text-layer PDF page (pdfjs-dist text items).
 * Returns DocumentElement[] for a single page.
 */
function buildTextPageElements(textItems, pageNumber, medianFontSize, currentSection) {
  if (!textItems || textItems.length === 0) return [];

  const elements = [];
  let activeSection = currentSection;

  // Group items into lines by Y coordinate proximity
  const lines = groupItemsIntoLines(textItems);

  // Merge lines into logical paragraphs
  const blocks = mergeLinesToBlocks(lines);

  for (const block of blocks) {
    if (!block.text.trim()) continue;

    const isHeading = block.fontSize > medianFontSize * HEADING_FONT_MULTIPLIER
      && block.text.length >= MIN_HEADING_LENGTH
      && block.text.length <= MAX_HEADING_LENGTH
      && !block.text.includes('\n\n'); // headings don't span multiple paragraphs

    // Also detect headings by pattern (numbered sections, ALL CAPS short lines)
    const isPatternHeading = !isHeading && isLikelyHeading(block.text);

    if (isHeading || isPatternHeading) {
      activeSection = block.text.trim().replace(/\s+/g, ' ');
      elements.push({
        type: 'heading',
        content: activeSection,
        pageNumber,
        sectionHeading: activeSection,
        contentType: 'text',
        metadata: { isHeading: true },
      });
    } else {
      elements.push({
        type: 'paragraph',
        content: block.text.trim(),
        pageNumber,
        sectionHeading: activeSection,
        contentType: 'text',
        metadata: { fontSize: Math.round(block.fontSize) },
      });
    }
  }

  return elements;
}

/**
 * Build elements from a Gemini vision result for a single page.
 */
function buildVisionPageElements(visionResult, pageNumber, currentSection) {
  const elements = [];
  let activeSection = currentSection;

  if (!visionResult) return elements;

  // OCR text content
  if (visionResult.ocr_text && visionResult.ocr_text.trim()) {
    // Try to detect headings in OCR text
    const lines = visionResult.ocr_text.split('\n');
    let paragraphBuffer = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (paragraphBuffer.length > 0) {
          const text = paragraphBuffer.join('\n').trim();
          if (text) {
            elements.push({
              type: 'paragraph',
              content: text,
              pageNumber,
              sectionHeading: activeSection,
              contentType: 'ocr',
              metadata: { confidence: visionResult.reading_confidence },
            });
          }
          paragraphBuffer = [];
        }
        continue;
      }

      if (isLikelyHeading(trimmed) && trimmed.length <= MAX_HEADING_LENGTH) {
        if (paragraphBuffer.length > 0) {
          const text = paragraphBuffer.join('\n').trim();
          if (text) {
            elements.push({
              type: 'paragraph',
              content: text,
              pageNumber,
              sectionHeading: activeSection,
              contentType: 'ocr',
              metadata: { confidence: visionResult.reading_confidence },
            });
          }
          paragraphBuffer = [];
        }
        activeSection = trimmed;
        elements.push({
          type: 'heading',
          content: trimmed,
          pageNumber,
          sectionHeading: trimmed,
          contentType: 'text',
          metadata: { fromOcr: true },
        });
      } else {
        paragraphBuffer.push(trimmed);
      }
    }

    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join('\n').trim();
      if (text) {
        elements.push({
          type: 'paragraph',
          content: text,
          pageNumber,
          sectionHeading: activeSection,
          contentType: 'ocr',
          metadata: { confidence: visionResult.reading_confidence },
        });
      }
    }
  }

  // Tables from vision
  for (const table of (visionResult.tables || [])) {
    if (!table.markdown || !table.markdown.trim()) continue;
    elements.push({
      type: 'table',
      content: table.caption
        ? `**${table.caption}**\n\n${table.markdown}`
        : table.markdown,
      pageNumber,
      sectionHeading: activeSection,
      contentType: 'table',
      metadata: { caption: table.caption || '' },
    });
  }

  // Visual elements (charts, diagrams)
  for (const visual of (visionResult.visuals || [])) {
    const parts = [];
    if (visual.title) parts.push(`**${visual.title}**`);
    if (visual.description) parts.push(visual.description);
    if (visual.data_summary) parts.push(`Data: ${visual.data_summary}`);
    if (visual.x_axis_label) parts.push(`X-axis: ${visual.x_axis_label}`);
    if (visual.y_axis_label) parts.push(`Y-axis: ${visual.y_axis_label}`);
    if (visual.legend_items?.length) parts.push(`Legend: ${visual.legend_items.join(', ')}`);

    if (parts.length === 0) continue;

    elements.push({
      type: visual.type?.includes('chart') || visual.type?.includes('plot') ? 'chart' : 'image',
      content: parts.join('\n'),
      pageNumber,
      sectionHeading: activeSection,
      contentType: visual.type?.includes('chart') || visual.type?.includes('plot') ? 'chart' : 'image',
      metadata: {
        visualType: visual.type,
        title: visual.title || '',
        xAxis: visual.x_axis_label || '',
        yAxis: visual.y_axis_label || '',
      },
    });
  }

  return elements;
}

// ── DOCX Element Building ──────────────────────────────────────────────────────

/**
 * Build elements from mammoth's HTML output.
 * mammoth produces well-formed HTML with h1-h6, p, table, ul, ol, li tags.
 */
function buildDocxElements(html) {
  const elements = [];
  let currentSection = '';

  // Walk through HTML nodes in document order using simple regex-based parsing.
  // mammoth produces predictable, clean HTML without deeply nested inline styles.
  const tagPattern = /<(h[1-6]|p|table|ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const text = stripHtml(inner).trim();

    if (!text && tag !== 'table') continue;

    if (/^h[1-6]$/.test(tag)) {
      currentSection = text;
      elements.push({
        type: 'heading',
        content: text,
        pageNumber: null,
        sectionHeading: text,
        contentType: 'text',
        metadata: { headingLevel: parseInt(tag[1]) },
      });
    } else if (tag === 'table') {
      const markdown = htmlTableToMarkdown(match[0]);
      if (markdown) {
        elements.push({
          type: 'table',
          content: markdown,
          pageNumber: null,
          sectionHeading: currentSection,
          contentType: 'table',
          metadata: {},
        });
      }
    } else if (tag === 'p' || tag === 'ul' || tag === 'ol') {
      if (text.length < 2) continue;
      elements.push({
        type: 'paragraph',
        content: text,
        pageNumber: null,
        sectionHeading: currentSection,
        contentType: 'text',
        metadata: {},
      });
    }
  }

  return elements;
}

// ── Spreadsheet Element Building ───────────────────────────────────────────────

function buildSpreadsheetElements(xlsxBuffer, mimeType) {
  const XLSX = require('xlsx');
  const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const elements = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    // Build Markdown table
    const nonEmptyRows = rows.filter((r) => r.some((c) => String(c).trim()));
    if (nonEmptyRows.length === 0) continue;

    const header = nonEmptyRows[0].map((c) => String(c).replace(/\|/g, '\\|'));
    const separator = header.map(() => '---');
    const dataRows = nonEmptyRows.slice(1).map((r) =>
      r.map((c) => String(c).replace(/\|/g, '\\|')),
    );

    const markdown = [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...dataRows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n');

    elements.push({
      type: 'table',
      content: `**Sheet: ${sheetName}**\n\n${markdown}`,
      pageNumber: null,
      sectionHeading: sheetName,
      contentType: 'table',
      metadata: { sheetName, rows: nonEmptyRows.length, cols: header.length },
    });
  }

  return elements;
}

// ── Plain Text Element Building ────────────────────────────────────────────────

function buildPlainTextElements(text) {
  const elements = [];
  let currentSection = '';

  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalised.split(/\n{2,}/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Markdown headings (# ## ###)
    const mdHeading = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (mdHeading) {
      currentSection = mdHeading[2].trim();
      elements.push({
        type: 'heading',
        content: currentSection,
        pageNumber: null,
        sectionHeading: currentSection,
        contentType: 'text',
        metadata: { headingLevel: mdHeading[1].length },
      });
      continue;
    }

    // Markdown tables
    if (trimmed.startsWith('|') && trimmed.includes('|---')) {
      elements.push({
        type: 'table',
        content: trimmed,
        pageNumber: null,
        sectionHeading: currentSection,
        contentType: 'table',
        metadata: {},
      });
      continue;
    }

    // Pattern headings (short, ALL CAPS, ends with : or is numbered)
    if (isLikelyHeading(trimmed) && trimmed.length <= MAX_HEADING_LENGTH) {
      currentSection = trimmed;
      elements.push({
        type: 'heading',
        content: trimmed,
        pageNumber: null,
        sectionHeading: trimmed,
        contentType: 'text',
        metadata: {},
      });
      continue;
    }

    elements.push({
      type: 'paragraph',
      content: trimmed,
      pageNumber: null,
      sectionHeading: currentSection,
      contentType: 'text',
      metadata: {},
    });
  }

  return elements;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function groupItemsIntoLines(items) {
  if (!items.length) return [];

  // Sort by Y descending (PDF coords: top = high Y), then X ascending
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  let currentLine = [sorted[0]];
  const LINE_TOLERANCE = 3; // px

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const prevY = currentLine[currentLine.length - 1].y;
    if (Math.abs(item.y - prevY) <= LINE_TOLERANCE) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
    }
  }
  if (currentLine.length) lines.push(currentLine);

  return lines.map((line) => ({
    text: line.map((i) => i.str).join(' ').replace(/\s+/g, ' '),
    fontSize: Math.max(...line.map((i) => i.fontSize)),
    y: line[0].y,
  }));
}

function mergeLinesToBlocks(lines) {
  const blocks = [];
  let currentBlock = null;
  const PARA_GAP = 12; // px gap between lines that indicates new paragraph

  for (const line of lines) {
    if (!currentBlock) {
      currentBlock = { text: line.text, fontSize: line.fontSize, lastY: line.y };
      continue;
    }

    const gap = currentBlock.lastY - line.y;
    const sameFont = Math.abs(line.fontSize - currentBlock.fontSize) < 2;

    if (gap > PARA_GAP || !sameFont) {
      blocks.push(currentBlock);
      currentBlock = { text: line.text, fontSize: line.fontSize, lastY: line.y };
    } else {
      currentBlock.text += ' ' + line.text;
      currentBlock.lastY = line.y;
    }
  }
  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

function isLikelyHeading(text) {
  if (!text || text.length < 2 || text.length > 150) return false;
  // Numbered section: "1.", "1.2", "1.2.3 Title"
  if (/^\d+(\.\d+)*\.?\s+\S/.test(text)) return true;
  // ALL CAPS (at least 4 chars, no sentence punctuation)
  if (text === text.toUpperCase() && text.length >= 4 && !/[.?!]/.test(text)) return true;
  // Ends with colon (short label)
  if (text.endsWith(':') && text.split(' ').length <= 8) return true;
  // Title Case short phrase (no common stop words mid-sentence)
  if (/^[A-Z][a-z]/.test(text) && text.split(' ').length <= 6 && !/[.?!,]/.test(text.slice(0, -1))) return true;
  return false;
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function htmlTableToMarkdown(tableHtml) {
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
    const cellPattern = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells = [];
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(stripHtml(cellMatch[1]).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim());
    }

    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return '';

  const header = rows[0];
  const separator = header.map(() => '---');
  const body = rows.slice(1);

  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

module.exports = {
  buildTextPageElements,
  buildVisionPageElements,
  buildDocxElements,
  buildSpreadsheetElements,
  buildPlainTextElements,
};
