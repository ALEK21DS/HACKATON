import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService, type WhatsappTier } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get() {
    const [whatsappTier, dailyLimit, geminiModel, geminiModelInUse] = await Promise.all([
      this.settings.getWhatsappTier(),
      this.settings.getDailyLimit(),
      this.settings.getGeminiModel(),
      this.settings.getGeminiModelInUse(),
    ]);
    return {
      whatsappTier,
      dailyLimit: dailyLimit === Number.MAX_SAFE_INTEGER ? null : dailyLimit, // null = ilimitado
      geminiModel,
      geminiModelInUse,
    };
  }

  @Patch()
  async update(
    @Body()
    body: {
      whatsappTier?: WhatsappTier;
      geminiModel?: string;
    },
  ) {
    if (body.whatsappTier !== undefined) {
      await this.settings.setWhatsappTier(body.whatsappTier);
    }
    if (body.geminiModel !== undefined) {
      await this.settings.setGeminiModel(body.geminiModel.trim());
    }
    return this.get();
  }
}
