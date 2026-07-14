import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { BulkTransferOwnershipUseCase } from '../application/bulk-transfer-ownership.use-case';
import { BulkTransferOwnershipDto } from './dto/bulk-transfer-ownership.dto';

@ApiTags('Offboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('offboarding')
export class OffboardingController {
  constructor(
    private readonly bulkTransferOwnershipUseCase: BulkTransferOwnershipUseCase,
  ) {}

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({
    summary: 'Bulk transfer ownership and assignments between users',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role or permissions' })
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkTransferOwnershipDto,
  ) {
    return this.bulkTransferOwnershipUseCase.execute(
      user,
      dto.fromUserId,
      dto.toUserId,
    );
  }
}
