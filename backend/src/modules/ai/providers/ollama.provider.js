import { Ollama } from 'ollama';

/**
 * @param {object} config
 * @param {string} config.baseUrl
 * @param {string} config.llmModel
 * @param {string} config.embeddingModel
 * @param {string} config.visionModel
 */
export class OllamaProvider {
  constructor(config) {
    this.ollama = new Ollama({ host: config.baseUrl || 'http://localhost:11434' });
    this.llmModel = config.llmModel || 'llama3.2';
    // nomic-embed-text produces 768-dim embeddings — matches EMBEDDING_DIMENSION=768.
    this.embeddingModel = config.embeddingModel || 'nomic-embed-text';
    this.visionModel = config.visionModel || 'llava';
  }

  async generateText(prompt, systemInstruction = '') {
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });
    const response = await this.ollama.chat({ model: this.llmModel, messages });
    return response.message.content;
  }

  async *streamChat(messages, systemInstruction = '', modelOverride = null) {
    const ollamaMessages = [];
    if (systemInstruction) ollamaMessages.push({ role: 'system', content: systemInstruction });
    for (const m of messages) {
      ollamaMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }

    const stream = await this.ollama.chat({
      model: modelOverride || this.llmModel,
      messages: ollamaMessages,
      stream: true,
    });

    for await (const part of stream) {
      const text = part.message?.content;
      if (text) yield text;
    }
  }

  async embedText(text) {
    const response = await this.ollama.embed({
      model: this.embeddingModel,
      input: text.replace(/\n/g, ' '),
    });
    return response.embeddings[0];
  }

  async embedBatch(texts) {
    const response = await this.ollama.embed({
      model: this.embeddingModel,
      input: texts.map((t) => t.replace(/\n/g, ' ')),
    });
    return response.embeddings;
  }

  async analyzeImage(imageBuffer, prompt) {
    const response = await this.ollama.chat({
      model: this.visionModel,
      messages: [{
        role: 'user',
        content: prompt,
        images: [imageBuffer],
      }],
    });
    return response.message.content;
  }
}
