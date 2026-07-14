import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EntityType } from '../../../../shared/activity-log/domain/audit.types';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';

export class ListActivityLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EntityType })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;
}
