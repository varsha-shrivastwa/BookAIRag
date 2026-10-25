import 'reflect-metadata'; // Must be first import — required by NestJS DI & decorators
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Raise body size limit before NestJS pipes intercept requests (needed for multer + large uploads)
  app.use(express.json({ limit: '21mb' }));
  app.use(express.urlencoded({ extended: true, limit: '21mb' }));

  // credentials:true requires an explicit origin, not a wildcard.
  // Always allow any localhost port (Next.js picks a free port dynamically in dev).
  // CORS_ORIGIN in .env can add extra allowed origins (comma-separated).
  const extraOrigins = (process.env.CORS_ORIGIN || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // server-to-server / curl
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      if (extraOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Global validation pipe with whitelist (strip unknown fields) and transform
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Book RAG Chatbot API')
    .setDescription('AI-powered book recommendation API using a RAG pipeline over pgvector + Google Books')
    .setVersion('1.0')
    .addTag('chat', 'Conversational book recommendation endpoints')
    .addTag('books', 'Google Books catalog search with pagination')
    .addTag('health', 'Service health check')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Book RAG Chatbot Backend running on http://localhost:${port}/api`);
  logger.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();
