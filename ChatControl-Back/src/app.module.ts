import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { ContactsModule } from './contacts/contacts.module';
import { TemplatesModule } from './templates/templates.module';
import { SettingsModule } from './settings/settings.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PlatformModule } from './platform/platform.module';
import { OrgUsersModule } from './org-users/org-users.module';
import { OrgAuditModule } from './org-audit/org-audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    AuthModule,
    WhatsAppModule,
    ChatModule,
    AiModule,
    BroadcastModule,
    ContactsModule,
    TemplatesModule,
    SettingsModule,
    IntegrationsModule,
    PlatformModule,
    OrgUsersModule,
    OrgAuditModule,
  ],
})
export class AppModule {}
