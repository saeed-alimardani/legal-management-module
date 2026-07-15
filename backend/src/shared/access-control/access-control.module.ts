import { Global, Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { MatterInvolvementService } from './matter-involvement.service';

@Global()
@Module({
  providers: [AccessControlService, MatterInvolvementService],
  exports: [AccessControlService, MatterInvolvementService],
})
export class AccessControlModule {}
