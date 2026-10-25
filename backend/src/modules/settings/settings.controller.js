import { Controller, Get, Put, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AiService } from '../ai/ai.service.js';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(aiService) {
    this.aiService = aiService;
  }

  @Get('ai')
  getAiSettings() {
    return this.aiService.getSettings();
  }

  @Put('ai')
  updateAiSettings(@Body() body) {
    const { provider, gemini, ollama, claude } = body || {};

    if (!provider || !['gemini', 'ollama', 'claude'].includes(provider)) {
      throw new BadRequestException('provider must be "gemini", "ollama", or "claude".');
    }

    return this.aiService.switchProvider(provider, gemini, ollama, claude);
  }
}

Reflect.defineMetadata('design:paramtypes', [AiService], SettingsController);
