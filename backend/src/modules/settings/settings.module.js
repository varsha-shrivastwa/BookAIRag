import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SettingsController } from './settings.controller.js';

// AiService is provided globally by AiModule (@Global), so no need to import AiModule here.
@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
