import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

export interface AssignedResult {
  conversationId: string;
  assignedToUserId: string | null;
  isNewAssignment: boolean;
}

@Injectable()
export class LeadAssignmentService {
  private readonly logger = new Logger(LeadAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async assignNewLead(conversationId: string, organizationId: string): Promise<AssignedResult> {
    const alreadyAssigned = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { assignedToUserId: true, isNewLead: true },
    });
    if (alreadyAssigned?.assignedToUserId) {
      return { conversationId, assignedToUserId: alreadyAssigned.assignedToUserId, isNewAssignment: false };
    }

    const nextAgentId = await this.getNextAgentInTurn(organizationId);
    const now = new Date();

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToUserId: nextAgentId,
        assignedAt: now,
        isNewLead: true,
      },
    });

    if (nextAgentId) {
      this.chatGateway.emitConversationAssigned(organizationId, conversationId, nextAgentId);
    }

    return { conversationId, assignedToUserId: nextAgentId, isNewAssignment: true };
  }

  private async getNextAgentInTurn(organizationId: string): Promise<string | null> {
    const agents = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [UserRole.ORG_ADMIN, UserRole.AGENT] },
      },
      select: { id: true },
    });

    if (agents.length === 0) return null;

    const agentIds = agents.map(a => a.id);

    const lastAssigned = await this.prisma.conversation.findFirst({
      where: {
        assignedToUserId: { in: agentIds, not: null },
        contact: { organizationId },
      },
      orderBy: { assignedAt: 'desc' },
      select: { assignedToUserId: true },
    });

    const lastIndex = lastAssigned?.assignedToUserId
      ? agentIds.indexOf(lastAssigned.assignedToUserId)
      : -1;

    const nextIndex = (lastIndex + 1) % agentIds.length;
    return agentIds[nextIndex];
  }
}
