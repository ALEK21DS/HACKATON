import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { ContactsModule } from './contacts/contacts.module';
import { TemplatesModule } from './templates/templates.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WhatsAppModule,
    ChatModule,
    AiModule,
    BroadcastModule,
    ContactsModule,
    TemplatesModule,
    SettingsModule,
  ],
})
export class AppModule {}
