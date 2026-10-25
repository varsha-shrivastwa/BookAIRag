import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OllamaProvider } from './providers/ollama.provider.js';
import { ClaudeProvider } from './providers/claude.provider.js';

@Injectable()
export class AiService {
  constructor(configService) {
    this.configService = configService;
    this.logger = new Logger(AiService.name);

    // Build full settings object from env at startup
    this.settings = this._buildSettingsFromEnv();
    this._applyProvider(this.settings.provider);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  _buildSettingsFromEnv() {
    const dim = parseInt(this.configService.get('EMBEDDING_DIMENSION') || '768', 10);
    const llm = this.configService.get('LLM_MODEL') || 'gemini-2.0-flash';
    return {
      provider: this.configService.get('AI_PROVIDER') || 'gemini',
      gemini: {
        apiKey:            this.configService.get('GEMINI_API_KEY') || '',
        llmModel:          llm,
        embeddingModel:    this.configService.get('EMBEDDING_MODEL') || 'gemini-embedding-001',
        embeddingDimension: dim,
        visionModel:       this.configService.get('VISION_MODEL') || llm,
      },
      ollama: {
        baseUrl:           this.configService.get('OLLAMA_BASE_URL') || 'http://localhost:11434',
        llmModel:          this.configService.get('OLLAMA_LLM_MODEL') || 'llama3.2',
        embeddingModel:    this.configService.get('OLLAMA_EMBEDDING_MODEL') || 'nomic-embed-text',
        visionModel:       this.configService.get('OLLAMA_VISION_MODEL') || 'llava',
        embeddingDimension: dim,
      },
      claude: {
        apiKey:            this.configService.get('CLAUDE_API_KEY') || '',
        llmModel:          this.configService.get('CLAUDE_LLM_MODEL') || 'claude-sonnet-4-6',
        visionModel:       this.configService.get('CLAUDE_VISION_MODEL') || 'claude-sonnet-4-6',
        embeddingApiKey:   this.configService.get('CLAUDE_EMBEDDING_API_KEY') || '',
        embeddingModel:    this.configService.get('CLAUDE_EMBEDDING_MODEL') || 'gemini-embedding-001',
        embeddingDimension: dim,
      },
    };
  }

  _applyProvider(providerName) {
    this.logger.log(`AI provider: ${providerName}`);
    if (providerName === 'ollama') {
      this.provider = new OllamaProvider(this.settings.ollama);
    } else if (providerName === 'claude') {
      this.provider = new ClaudeProvider(this.settings.claude);
    } else {
      this.provider = new GeminiProvider(this.settings.gemini);
    }
  }

  _maskKey(key) {
    if (!key) return '';
    if (key.length <= 10) return '●'.repeat(key.length);
    return key.slice(0, 6) + '●'.repeat(Math.min(key.length - 6, 24));
  }

  // ── Settings API (used by SettingsController) ─────────────────────────────

  /** Returns the current settings. API keys are masked. */
  getSettings() {
    return {
      provider: this.settings.provider,
      gemini: {
        ...this.settings.gemini,
        apiKey: this._maskKey(this.settings.gemini.apiKey),
      },
      ollama: { ...this.settings.ollama },
      claude: {
        ...this.settings.claude,
        apiKey: this._maskKey(this.settings.claude.apiKey),
        embeddingApiKey: this._maskKey(this.settings.claude.embeddingApiKey),
      },
    };
  }

  /**
   * Switch the active provider at runtime.
   * @param {'gemini'|'ollama'|'claude'} provider
   * @param {object} [geminiPatch]  fields to merge into the gemini config
   * @param {object} [ollamaPatch]  fields to merge into the ollama config
   * @param {object} [claudePatch]  fields to merge into the claude config
   */
  switchProvider(provider, geminiPatch, ollamaPatch, claudePatch) {
    if (geminiPatch) {
      const { apiKey, ...rest } = geminiPatch;
      // If the caller sent back a masked key (contains ●) keep the real stored key
      const resolvedKey = apiKey && !apiKey.includes('●') ? apiKey : this.settings.gemini.apiKey;
      this.settings.gemini = { ...this.settings.gemini, ...rest, apiKey: resolvedKey };
    }
    if (ollamaPatch) {
      this.settings.ollama = { ...this.settings.ollama, ...ollamaPatch };
    }
    if (claudePatch) {
      const { apiKey, embeddingApiKey, ...rest } = claudePatch;
      const resolvedKey = apiKey && !apiKey.includes('●') ? apiKey : this.settings.claude.apiKey;
      const resolvedEmbedKey = embeddingApiKey && !embeddingApiKey.includes('●')
        ? embeddingApiKey
        : this.settings.claude.embeddingApiKey;
      this.settings.claude = { ...this.settings.claude, ...rest, apiKey: resolvedKey, embeddingApiKey: resolvedEmbedKey };
    }
    this.settings.provider = provider;
    this._applyProvider(provider);
    return this.getSettings();
  }

  // ── Public AI methods (unchanged interface) ───────────────────────────────

  async generateText(prompt, systemInstruction = '') {
    return this.provider.generateText(prompt, systemInstruction);
  }

  async generateChatText(messages, systemInstruction = '') {
    let result = '';
    for await (const chunk of this.provider.streamChat(messages, systemInstruction)) {
      result += chunk;
    }
    return result;
  }

  async *streamChat(messages, systemInstruction = '', modelOverride = null) {
    yield* this.provider.streamChat(messages, systemInstruction, modelOverride);
  }

  async embedText(text) {
    return this.provider.embedText(text);
  }

  async embedBatch(texts) {
    return this.provider.embedBatch(texts);
  }

  async analyzeImage(imageBuffer, prompt) {
    return this.provider.analyzeImage(imageBuffer, prompt);
  }
}

Reflect.defineMetadata('design:paramtypes', [ConfigService], AiService);
