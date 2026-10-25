import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * @param {object} config
 * @param {string} config.apiKey             Anthropic API key
 * @param {string} config.llmModel           Chat/completion model
 * @param {string} config.visionModel        Vision model
 * @param {string} config.embeddingApiKey    Gemini API key used for embeddings (Claude has none)
 * @param {string} config.embeddingModel     Gemini embedding model name
 * @param {number} config.embeddingDimension Output dimension for embeddings
 */
export class ClaudeProvider {
  constructor(config) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.llmModel = config.llmModel || 'claude-sonnet-4-6';
    this.visionModel = config.visionModel || config.llmModel || 'claude-sonnet-4-6';
    this.embeddingDimension = config.embeddingDimension || 768;

    // Claude has no embedding API — delegate to Gemini if a key is supplied
    if (config.embeddingApiKey) {
      this.genAI = new GoogleGenerativeAI(config.embeddingApiKey);
      this.embeddingModel = config.embeddingModel || 'gemini-embedding-001';
    } else {
      this.genAI = null;
      this.embeddingModel = null;
    }
  }

  async generateText(prompt, systemInstruction = '') {
    const params = {
      model: this.llmModel,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    };
    if (systemInstruction) params.system = systemInstruction;

    const response = await this.client.messages.create(params);
    return response.content[0]?.text ?? '';
  }

  async *streamChat(messages, systemInstruction = '', modelOverride = null) {
    const anthropicMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const params = {
      model: modelOverride || this.llmModel,
      max_tokens: 8192,
      messages: anthropicMessages,
    };
    if (systemInstruction) params.system = systemInstruction;

    const stream = this.client.messages.stream(params);
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  _requireEmbeddings() {
    if (!this.genAI) {
      throw new Error(
        'Claude has no embedding API. Set a Gemini API key in Settings → Claude → Embedding API Key.',
      );
    }
  }

  async embedText(text) {
    this._requireEmbeddings();
    const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.embedContent({
      content: { parts: [{ text: text.replace(/\n/g, ' ') }] },
      outputDimensionality: this.embeddingDimension,
    });
    return result.embedding.values;
  }

  async embedBatch(texts) {
    this._requireEmbeddings();
    const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text: text.replace(/\n/g, ' ') }] },
        outputDimensionality: this.embeddingDimension,
      })),
    });
    return result.embeddings.map((e) => e.values);
  }

  async analyzeImage(imageBuffer, prompt) {
    const base64Data = imageBuffer.toString('base64');
    const response = await this.client.messages.create({
      model: this.visionModel,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
          { type: 'text', text: prompt },
        ],
      }],
    });
    return response.content[0]?.text ?? '';
  }
}
