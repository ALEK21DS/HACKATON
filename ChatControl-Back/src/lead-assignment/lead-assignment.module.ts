import { Module, forwardRef } from '@nestjs/common';
import { LeadAssignmentService } from './lead-assignment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ChatModule)],
  providers: [LeadAssignmentService],
  exports: [LeadAssignmentService],
})
export class LeadAssignmentModule {}
