import { Injectable } from '@nestjs/common';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ChatService {
  constructor(ragService) {
    this.ragService = ragService;
  }

  async processChatMessage(message, history = [], limit = 5) {
    if (!message || message.trim().length === 0) {
      return { reply: 'Please share what kind of books you are looking for!', recommendedBooks: [] };
    }
    return await this.ragService.generateRecommendation(message, history, limit);
  }

  async *streamChatMessage(message, history = [], limit = 5) {
    if (!message || message.trim().length === 0) {
      yield { type: 'chunk', content: 'Please share what kind of books you are looking for!' };
      yield { type: 'books', books: [] };
      return;
    }
    yield* this.ragService.streamRecommendation(message, history, limit);
  }
}

Reflect.defineMetadata('design:paramtypes', [RagService], ChatService);
