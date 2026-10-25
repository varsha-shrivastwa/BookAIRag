import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RagService } from '../rag/rag.service';
import { AiService } from '../ai/ai.service.js';

@Injectable()
export class ChatService {
  constructor(ragService, configService, aiService) {
    this.ragService = ragService;
    this.configService = configService;
    this.aiService = aiService;
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

  /** Generate a short 3-6 word title for a conversation based on the first message. */
  async generateTitle(message) {
    try {
      const prompt =
        `Generate a very short, descriptive title (3 to 6 words maximum) for a chat conversation that starts with this message: "${message.slice(0, 300)}"\n\nRules:\n- Reply with ONLY the title\n- No quotes, no punctuation at end\n- No explanations or extra text\n- Capitalize first word only`;
      const raw = (await this.aiService.generateText(prompt)).trim();
      return raw.replace(/^["'`]|["'`.]$/g, '').trim().slice(0, 60) || 'New chat';
    } catch {
      return 'New chat';
    }
  }

  /** Stream a general-purpose AI response with optional conversation history. */
  async *streamGeneralChat(message, history = [], modelOverride = null) {
    const systemInstruction =
      'You are DocAI, a helpful, knowledgeable, and friendly AI assistant. ' +
      'Provide clear, accurate, and well-structured answers. ' +
      'Use markdown formatting when it enhances readability (e.g., code blocks, lists, headings). ' +
      'Be concise yet thorough.';

    const messages = [
      ...history.slice(-40).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    for await (const text of this.aiService.streamChat(messages, systemInstruction, modelOverride)) {
      yield { type: 'chunk', content: text };
    }
  }
}

Reflect.defineMetadata('design:paramtypes', [RagService, ConfigService, AiService], ChatService);
