import { Controller, Post, Body, Req, Res, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { DocChatService } from './doc-chat.service.js';

@ApiTags('doc-chat')
@Controller('doc-chat')
export class DocChatController {
  constructor(docChatService) {
    this.docChatService = docChatService;
  }

  @Post('stream')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Stream AI answer over selected documents (SSE)' })
  async streamDocChat(@Body() body, @Req() req, @Res() res) {
    const { message, documentIds = [], history = [], model = null } = body || {};
    // Allow only safe model name strings (letters, digits, hyphens, dots)
    const modelOverride = (model && /^[\w.-]+$/.test(model)) ? model : null;

    // ── Input validation ──────────────────────────────────────────────────────
    if (typeof message !== 'string' || !message.trim()) {
      throw new BadRequestException('message is required.');
    }
    if (message.length > 2000) {
      throw new BadRequestException('message must be 2000 characters or fewer.');
    }
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new BadRequestException('documentIds must be a non-empty array.');
    }
    if (documentIds.length > 20) {
      throw new BadRequestException('At most 20 documents may be queried at once.');
    }
    if (!documentIds.every((id) => Number.isInteger(id) && id > 0)) {
      throw new BadRequestException('documentIds must be positive integers.');
    }
    if (!Array.isArray(history) || history.length > 40) {
      throw new BadRequestException('history must be an array of at most 40 messages.');
    }

    const userId = req.user.sub;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.docChatService.streamAnswer(message, documentIds, userId, history, modelOverride);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed.' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }

  // ── Streaming summary ───────────────────────────────────────────────────

  @Post('summarize')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Stream a full or section summary over selected documents (SSE). Body: { documentIds, type: "full"|"section", section?: { documentId, heading } }' })
  async streamSummary(@Body() body, @Req() req, @Res() res) {
    const { documentIds = [], type = 'full', section = null } = body || {};
    const userId = req.user.sub;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.docChatService.streamSummary(documentIds, userId, type, section);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Summary stream failed.' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
}

Reflect.defineMetadata('design:paramtypes', [DocChatService], DocChatController);
