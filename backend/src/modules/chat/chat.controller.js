import { Controller, Post, Body, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './chat.dto';
import { AuthGuard } from '../auth/auth.guard.js';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(chatService) {
    this.chatService = chatService;
  }

  // ── Existing book-recommendation endpoints ──────────────────────────────

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message and get book recommendations (full response)' })
  @ApiBody({ type: ChatMessageDto })
  async handleChatMessage(@Body() body) {
    const { message, history = [], limit = 5 } = body || {};
    return await this.chatService.processChatMessage(message, history, limit);
  }

  @Post('stream')
  @ApiOperation({ summary: 'Stream book recommendations token-by-token (SSE)' })
  @ApiBody({ type: ChatMessageDto })
  async handleStreamChatMessage(@Body() body, @Res() res) {
    const { message, history = [], limit = 5 } = body || {};

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.chatService.streamChatMessage(message, history, limit);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed.' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }

  // ── General AI chat endpoints ────────────────────────────────────────────

  /**
   * POST /api/chat/title
   * Generate a short conversation title from the user's first message.
   */
  @Post('title')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generate a short conversation title from the first message' })
  async generateTitle(@Body() body) {
    const { message } = body || {};
    if (!message?.trim()) return { title: 'New chat' };
    const title = await this.chatService.generateTitle(message.trim().slice(0, 500));
    return { title };
  }

  /**
   * POST /api/chat/ai-stream
   * Stream a general-purpose AI response with conversation history (SSE).
   * Body: { message: string, history: [{role, content}][] }
   */
  @Post('ai-stream')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Stream a general AI chat response (SSE)' })
  async handleAiStream(@Body() body, @Res() res) {
    const { message, history = [], model = null } = body || {};
    const modelOverride = (model && /^[\w.-]+$/.test(model)) ? model : null;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (!message?.trim()) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: 'Please ask me something!' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    try {
      const stream = this.chatService.streamGeneralChat(message.trim(), history, modelOverride);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed. Please try again.' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
}

Reflect.defineMetadata('design:paramtypes', [ChatService], ChatController);
