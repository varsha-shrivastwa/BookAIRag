import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * @param {object} config
 * @param {string} config.apiKey
 * @param {string} config.llmModel
 * @param {string} config.embeddingModel
 * @param {number} config.embeddingDimension
 * @param {string} config.visionModel
 */
export class GeminiProvider {
  constructor(config) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.llmModel = config.llmModel || 'gemini-2.0-flash';
    this.embeddingModel = config.embeddingModel || 'gemini-embedding-001';
    this.embeddingDimension = config.embeddingDimension || 768;
    this.visionModel = config.visionModel || config.llmModel || 'gemini-2.0-flash';
  }

  async generateText(prompt, systemInstruction = '') {
    const opts = { model: this.llmModel };
    if (systemInstruction) opts.systemInstruction = systemInstruction;
    const model = this.genAI.getGenerativeModel(opts);
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async *streamChat(messages, systemInstruction = '', modelOverride = null) {
    const opts = { model: modelOverride || this.llmModel };
    if (systemInstruction) opts.systemInstruction = systemInstruction;
    const model = this.genAI.getGenerativeModel(opts);

    const history = this._sanitizeHistory(messages.slice(0, -1));
    const currentMsg = messages[messages.length - 1];

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(currentMsg.content);

    for await (const chunk of result.stream) {
      try {
        const text = chunk.text();
        if (text) yield text;
      } catch (chunkErr) {
        const reason = chunk.candidates?.[0]?.finishReason ?? 'unknown';
        if (reason !== 'STOP') yield `\n⚠ (${reason}): ${chunkErr.message}`;
      }
    }
  }

  async embedText(text) {
    const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.embedContent({
      content: { parts: [{ text: text.replace(/\n/g, ' ') }] },
      outputDimensionality: this.embeddingDimension,
    });
    return result.embedding.values;
  }

  async embedBatch(texts) {
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
    const model = this.genAI.getGenerativeModel({
      model: this.visionModel,
      generationConfig: { temperature: 0.1 },
    });
    const base64Data = imageBuffer.toString('base64');
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: prompt },
        ],
      }],
    });
    return result.response.text();
  }

  _sanitizeHistory(messages) {
    const sanitized = [];
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
      if (typeof m.content !== 'string' || !m.content.trim()) continue;
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === role) continue;
      sanitized.push({ role, parts: [{ text: m.content.trim() }] });
    }
    while (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
      sanitized.pop();
    }
    return sanitized;
  }
}
