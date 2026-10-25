import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BooksModule } from './modules/books/books.module';
import { VectorStoreModule } from './modules/vector-store/vector-store.module';
import { RagModule } from './modules/rag/rag.module';
import { ChatModule } from './modules/chat/chat.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    // Global rate limiting: 30 requests per 60 seconds per IP (applies to all routes).
    // The upload endpoint overrides this to 10 per 15 minutes via @Throttle().
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000,
      limit: 30,
    }]),
    AiModule,
    SettingsModule,
    AuthModule,
    BooksModule,
    VectorStoreModule,
    RagModule,
    ChatModule,
    HealthModule,
    DocumentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
