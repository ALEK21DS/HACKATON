import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { OrgMemberGuard } from '../auth/org-member.guard';
import { UserRole } from '@prisma/client';
import { IntegrationsService, type UpdateIntegrationsDto, type LeadDetectionConfigDto } from './integrations.service';

@Controller('org/integrations')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  async getStatus(@CurrentUser() user: AuthUser) {
    return this.integrations.getStatus(user.organizationId!);
  }

  @Patch()
  async update(@CurrentUser() user: AuthUser, @Body() body: UpdateIntegrationsDto) {
    return this.integrations.update(user.organizationId!, body);
  }

  @Get('lead-detection')
  async getLeadDetection(@CurrentUser() user: AuthUser) {
    return this.integrations.getLeadDetectionConfig(user.organizationId!);
  }

  @Patch('lead-detection')
  async updateLeadDetection(
    @CurrentUser() user: AuthUser,
    @Body() config: LeadDetectionConfigDto,
  ) {
    return this.integrations.updateLeadDetectionConfig(user.organizationId!, config);
  }
}
