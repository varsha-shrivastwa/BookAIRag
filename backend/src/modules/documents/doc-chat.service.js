import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service.js';
import { DocumentsService } from './documents.service.js';
import { DOC_RAG_SYSTEM_PROMPT } from './prompts/doc-rag.prompt.js';
import { FULL_SUMMARY_SYSTEM_PROMPT, SECTION_SUMMARY_SYSTEM_PROMPT } from './prompts/summary.prompt.js';

const CONTENT_TYPE_LABELS = {
  text:  'text',
  table: 'table',
  chart: 'chart/graph',
  image: 'diagram/image',
  ocr:   'scanned text',
};

// Keywords that signal the user wants visual/structured content
const VISUAL_QUERY_RE = /\b(chart|graph|table|figure|trend|plot|diagram|visual|statistic|percent|breakdown|comparison|distribution|data|bar|pie|line|scatter|histogram|heatmap|infographic|metrics?|numbers?|figures?)\b/i;

// Detects figure/table labels in chunk text, e.g. "Figure 4", "Table 3A", "Fig. 2"
const FIGURE_LABEL_RE = /\b((?:figure|fig\.?|table|tbl\.?|chart|graph|diagram|exhibit)\s*\.?\s*\d+(?:\.\d+)?(?:\s*[a-z])?)\b/i;

function extractFigureLabel(content) {
  const match = (content || '').match(FIGURE_LABEL_RE);
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}

// Content types treated as visual/structured
const VISUAL_CONTENT_TYPES = ['table', 'chart', 'image'];

// Reciprocal Rank Fusion constant — standard value
const RRF_K = 60;

// Per-query retrieval budget; final context is capped at FINAL_TOP_K
const TOP_K_PER_QUERY = 20;
const FINAL_TOP_K = 20;
// When specific retrieval finds fewer than this many chunks, supplement with
// evenly-sampled chunks to give the AI broader document coverage.
const DIVERSE_FALLBACK_THRESHOLD = 6;

// Short prompt — we want 2-3 sub-questions, nothing else
const EXPAND_QUERY_PROMPT = `You are a search query decomposition assistant.
Break the following user question into 2 or 3 focused sub-questions that together cover all aspects of the original.
If recent conversation history is provided, use it to resolve pronouns and references (e.g., "it", "that chart", "the section you mentioned").
Respond with ONLY a valid JSON array of strings, no extra text, no markdown fences.
Example output: ["What is X?", "How does Y affect Z?"]

{historyContext}User question: {query}`;

@Injectable()
export class DocChatService {
  constructor(configService, documentsService, aiService) {
    this.configService = configService;
    this.documentsService = documentsService;
    this.aiService = aiService;
    this.logger = new Logger(DocChatService.name);
  }

  // ── Friendly error messages ───────────────────────────────────────────────

  _friendlyError(err) {
    const msg = String(err?.message || err || '');
    if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand') || msg.includes('overloaded')) {
      return 'The AI service is temporarily overloaded. Please try again in a moment.';
    }
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too Many Requests')) {
      return 'API rate limit reached. Please wait a moment before trying again.';
    }
    if (msg.includes('401') || msg.includes('403') || msg.includes('API key') || msg.includes('invalid key') || msg.includes('Unauthorized') || msg.includes('Permission denied')) {
      return 'AI provider authentication failed. Please check your API key in Settings.';
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('network')) {
      return 'Unable to reach the AI service. Please check your internet connection and try again.';
    }
    if (msg.includes('not found') && (msg.includes('model') || msg.includes('llama') || msg.includes('nomic') || msg.includes('llava') || msg.includes('gemini'))) {
      return 'The AI model is not available yet. If you just switched providers, wait for the model download to finish and try again.';
    }
    return 'The AI service encountered an error. Please try again.';
  }

  // ── Query expansion ───────────────────────────────────────────────────────

  /**
   * Uses the AI provider to decompose the user question into 2-3 sub-questions.
   * Always includes the original query. Falls back gracefully on any error.
   */
  async _expandQuery(userQuery, history = []) {
    try {
      let historyContext = '';
      if (history.length > 0) {
        const recent = history.slice(-4);
        const lines = recent.map((m) => {
          const role = m.role === 'assistant' ? 'Assistant' : 'User';
          return `${role}: ${String(m.content).slice(0, 200)}`;
        });
        historyContext = `Recent conversation:\n${lines.join('\n')}\n\n`;
      }

      const prompt = EXPAND_QUERY_PROMPT
        .replace('{historyContext}', historyContext)
        .replace('{query}', userQuery);
      const raw = (await this.aiService.generateText(prompt)).trim();

      const match = raw.match(/\[[\s\S]*?\]/);
      if (!match) return [userQuery];

      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) return [userQuery];

      const all = [userQuery, ...parsed.map((q) => String(q).trim()).filter(Boolean)];
      const seen = new Set();
      const unique = [];
      for (const q of all) {
        const key = q.toLowerCase();
        if (!seen.has(key)) { seen.add(key); unique.push(q); }
        if (unique.length === 4) break;
      }
      return unique;
    } catch (err) {
      this.logger.warn(`Query expansion skipped (${err.message})`);
      return [userQuery];
    }
  }

  _isVisualQuery(query) {
    return VISUAL_QUERY_RE.test(query);
  }

  /**
   * Extracts explicit chapter/section names from the query so we can
   * run a targeted heading-pattern search alongside semantic retrieval.
   */
  _extractSectionReferences(query) {
    const patterns = new Set();
    let m;

    const chapterRe = /\b(?:ch(?:apter)?\.?\s*)(\d+(?:\.\d+)?)\b/gi;
    while ((m = chapterRe.exec(query)) !== null) {
      patterns.add(`chapter ${m[1]}`);
    }

    const sectionRe = /\b(?:sec(?:tion)?\.?\s*)(\d+(?:\.\d+)*)\b/gi;
    while ((m = sectionRe.exec(query)) !== null) {
      patterns.add(m[1]);
    }

    const appendixRe = /\b(?:appendix|app\.?\s*)([A-Z]|\d+)\b/gi;
    while ((m = appendixRe.exec(query)) !== null) {
      patterns.add(`appendix ${m[1]}`);
    }

    return [...patterns];
  }

  /**
   * Detects an explicit page reference in the query.
   * Returns { start, end } or null.
   */
  _extractPageReference(query) {
    const match = query.match(/\bpages?\s+(\d+)(?:\s*(?:[-–—]|to|and)\s*(\d+))?\b/i);
    if (!match) return null;
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    return { start, end };
  }

  // ── Page-spread diversity constraint ─────────────────────────────────────

  _applyPageDiversity(rrfSorted, maxPerPage = 3, skipConstraint = false) {
    if (skipConstraint) return rrfSorted;

    const buckets = new Map();
    const accepted = [];
    const overflow = [];

    for (const item of rrfSorted) {
      const key = `${item.document_id}:${item.page_number ?? 'np'}`;
      const count = buckets.get(key) || 0;
      if (count < maxPerPage) {
        accepted.push(item);
        buckets.set(key, count + 1);
      } else {
        overflow.push(item);
      }
    }

    return [...accepted, ...overflow];
  }

  // ── Reciprocal Rank Fusion ────────────────────────────────────────────────

  _applyRRF(resultSets) {
    const scores = new Map();

    for (const results of resultSets) {
      results.forEach((chunk, rank) => {
        const key = chunk.id;
        const increment = 1 / (RRF_K + rank + 1);
        if (scores.has(key)) {
          scores.get(key).rrfScore += increment;
        } else {
          scores.set(key, { rrfScore: increment, chunk });
        }
      });
    }

    return [...scores.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(({ rrfScore, chunk }) => ({ ...chunk, similarity_score: Math.round(rrfScore * 1000) / 1000 }));
  }

  // ── Context builder ───────────────────────────────────────────────────────

  _buildContext(chunks) {
    if (!chunks || chunks.length === 0) return 'No relevant content found in the selected documents.';

    return chunks
      .map((c, i) => {
        const meta = [`"${c.document_name}"`];
        if (c.page_number) meta.push(`Page ${c.page_number}`);
        if (c.section_heading) meta.push(`§ ${c.section_heading}`);
        const typeLabel = CONTENT_TYPE_LABELS[c.content_type] || c.content_type || 'text';
        if (typeLabel !== 'text') meta.push(`(${typeLabel})`);
        const figLabel = extractFigureLabel(c.content);
        if (figLabel) meta.push(figLabel);
        return `[${i + 1} — ${meta.join(', ')}]\n${c.content}`;
      })
      .join('\n\n---\n\n');
  }

  _buildMessages(history, userQuery) {
    if (!Array.isArray(history) || history.length === 0) {
      return [{ role: 'user', content: userQuery }];
    }

    const sanitized = [];
    for (const m of history) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
      if (typeof m.content !== 'string' || !m.content.trim()) continue;
      sanitized.push({ role: m.role, content: m.content.trim() });
    }

    return [...sanitized, { role: 'user', content: userQuery }];
  }

  // ── Main stream method ────────────────────────────────────────────────────

  async *streamAnswer(rawQuery, documentIds, userId, history = [], modelOverride = null) {
    if (!documentIds || documentIds.length === 0) {
      yield { type: 'chunk', content: 'Please select at least one document before asking a question.' };
      return;
    }

    // Strip #N document references (UI construct; not part of the semantic query)
    const userQuery = rawQuery.trim().replace(/#\d+\b\s*/g, '').replace(/\s+/g, ' ').trim() || rawQuery.trim();

    // ── Step 1: Expand the query into sub-questions (history-aware)
    const subQueries = await this._expandQuery(userQuery, history);
    const isVisual    = this._isVisualQuery(userQuery);
    const pageRef     = this._extractPageReference(userQuery);
    const sectionRefs = this._extractSectionReferences(userQuery);

    this.logger.debug(
      `Multi-query RAG: ${subQueries.length} queries, visual=${isVisual} — "${userQuery}"`,
    );

    // ── Step 2: Embed all sub-queries in parallel
    const embeddings = await Promise.all(
      subQueries.map((q) => this.documentsService.generateEmbedding(q)),
    );

    // ── Step 3: Retrieve for each sub-query (all in parallel)
    const searchPromises = embeddings.map((emb) =>
      this.documentsService.searchDocumentChunksByEmbedding(
        emb, documentIds, userId, TOP_K_PER_QUERY, null,
      ),
    );

    // ── Step 4a: Visual boost
    if (isVisual) {
      searchPromises.push(
        this.documentsService.searchDocumentChunksByEmbedding(
          embeddings[0], documentIds, userId, 10, VISUAL_CONTENT_TYPES,
        ),
      );
    }

    // ── Step 4b: Page-specific boost
    if (pageRef) {
      this.logger.debug(`Page reference detected: pages ${pageRef.start}–${pageRef.end}`);
      searchPromises.push(
        this.documentsService.getChunksByPageRange(
          documentIds, userId, pageRef.start, pageRef.end, 20,
        ),
      );
    }

    // ── Step 4c: Keyword (full-text) search
    searchPromises.push(
      this.documentsService.keywordSearchDocumentChunks(
        userQuery, documentIds, userId, TOP_K_PER_QUERY,
      ),
    );

    // ── Step 4d: Section-heading retrieval
    if (sectionRefs.length > 0) {
      this.logger.debug(`Section refs detected: ${sectionRefs.join(', ')}`);
      searchPromises.push(
        this.documentsService.searchChunksByHeadingPatterns(
          documentIds, userId, sectionRefs, TOP_K_PER_QUERY,
        ),
      );
    }

    const resultSets = await Promise.all(searchPromises);

    // ── Step 5: Merge via RRF + page-spread diversity
    const merged = this._applyRRF(resultSets);
    const diversified = this._applyPageDiversity(merged, 3, !!pageRef);
    const final = diversified.slice(0, FINAL_TOP_K);

    // ── Step 5b: Diverse-chunk fallback ──────────────────────────────────────
    // When specific retrieval finds very few chunks the semantic match is likely
    // poor (broad question, terminology mismatch, etc.).  Supplement with evenly-
    // sampled chunks so the AI has enough document coverage to attempt an answer.
    if (final.length < DIVERSE_FALLBACK_THRESHOLD) {
      try {
        const wantExtra = FINAL_TOP_K - final.length;
        const diverse = await this.documentsService.getDiverseChunks(documentIds, userId, wantExtra + final.length);
        const existingIds = new Set(final.map((c) => c.id));
        for (const c of diverse) {
          if (!existingIds.has(c.id) && final.length < FINAL_TOP_K) {
            final.push(c);
            existingIds.add(c.id);
          }
        }
        if (final.length > 0) {
          this.logger.debug(`Diverse fallback added chunks; total=${final.length}`);
        }
      } catch (err) {
        this.logger.warn(`Diverse fallback failed: ${err.message}`);
      }
    }

    // ── Step 6: Short-circuit when no chunks match
    if (final.length === 0) {
      yield {
        type: 'chunk',
        content: "I couldn't find relevant content in this document. The document may not have been indexed yet, or it may not contain information on this topic. Try asking about what the document generally covers, or check that the document processed successfully.",
      };
      return;
    }

    // ── Build context and stream the answer
    const contextString = this._buildContext(final);
    const systemPrompt = DOC_RAG_SYSTEM_PROMPT
      .replace('{context}', contextString)
      .replace('{userQuery}', userQuery);

    const messages = this._buildMessages(history, userQuery);

    try {
      for await (const text of this.aiService.streamChat(messages, systemPrompt, modelOverride)) {
        yield { type: 'chunk', content: text };
      }
    } catch (err) {
      this.logger.error(`AI streaming failed: ${err.message}`, err.stack);
      yield { type: 'chunk', content: this._friendlyError(err) };
    }

    // Emit sources so the UI can display citations
    const sources = final.slice(0, 8).map((c) => ({
      documentId:   c.document_id,
      documentName: c.document_name,
      pageNumber:   c.page_number ?? null,
      sectionHeading: c.section_heading ?? null,
      contentType:  c.content_type || 'text',
      excerpt:      (c.content || '').slice(0, 280),
      figureLabel:  extractFigureLabel(c.content),
    }));
    yield { type: 'sources', sources };
  }

  // ── Streaming summary ─────────────────────────────────────────────────────

  async *streamSummary(documentIds, userId, type, section = null, modelOverride = null) {
    let chunks;
    let systemPrompt;

    if (type === 'section') {
      if (!section || !section.documentId || !section.heading) {
        yield { type: 'error', message: 'section.documentId and section.heading are required.' };
        return;
      }

      chunks = await this.documentsService.getChunksForSection(
        section.documentId, userId, section.heading,
      );

      if (!chunks || chunks.length === 0) {
        yield { type: 'chunk', content: `No content found for section "${section.heading}".` };
        return;
      }

      const docName = chunks[0].document_name || String(section.documentId);
      systemPrompt = SECTION_SUMMARY_SYSTEM_PROMPT
        .replace('{section}', section.heading)
        .replace('{documentName}', docName)
        .replace('{context}', this._buildContext(chunks));
    } else {
      chunks = await this.documentsService.getDiverseChunks(documentIds, userId, 24);

      if (!chunks || chunks.length === 0) {
        yield { type: 'chunk', content: 'No content found in the selected documents.' };
        return;
      }

      systemPrompt = FULL_SUMMARY_SYSTEM_PROMPT
        .replace('{context}', this._buildContext(chunks));
    }

    const prompt = type === 'section'
      ? `Summarize the "${section.heading}" section.`
      : 'Provide a comprehensive summary of the documents.';

    try {
      for await (const text of this.aiService.streamChat(
        [{ role: 'user', content: prompt }],
        systemPrompt,
        modelOverride,
      )) {
        yield { type: 'chunk', content: text };
      }
    } catch (err) {
      this.logger.warn(`Summary streaming failed: ${err.message}`);
      yield { type: 'chunk', content: this._friendlyError(err) };
    }
  }
}

Reflect.defineMetadata('design:paramtypes', [ConfigService, DocumentsService, AiService], DocChatService);
