import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { LeadAssignmentService } from './lead-assignment.service';
import { normalizeMessageText, computeSimilarity } from '../common/text-similarity.util';

@Injectable()
export class LeadDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly leadAssignment: LeadAssignmentService,
  ) {}

  async tryAutoDetectAndAssign(
    conversationId: string,
    organizationId: string,
    messageText: string,
  ): Promise<void> {
    try {
      const config = await this.integrations.getLeadDetectionConfig(organizationId);
      if (!config.enabled || !config.autoMessage) return;

      const normalizedReceived = normalizeMessageText(messageText);
      const normalizedConfigured = normalizeMessageText(config.autoMessage);

      if (normalizedReceived.length < 10 || normalizedConfigured.length < 10) return;

      const similarity = computeSimilarity(normalizedReceived, normalizedConfigured);
      if (similarity < 0.75) return;

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          autoMessageDetectedAt: new Date(),
          isNewLead: true,
        },
      });

      await this.leadAssignment.assignNewLead(conversationId, organizationId);
    } catch (error) {
      // Silently fail - lead detection should never break message reception
    }
  }
}
