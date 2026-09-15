import { Controller, Post, Body, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './chat.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(chatService) {
    this.chatService = chatService;
  }

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
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed.' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
}

Reflect.defineMetadata('design:paramtypes', [ChatService], ChatController);
