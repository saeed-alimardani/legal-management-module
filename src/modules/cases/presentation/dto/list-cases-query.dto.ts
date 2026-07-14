import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';
import { CaseStatus } from '../../domain/case-status.enum';
import { CaseType } from '../../domain/case-type.enum';

export class ListCasesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CaseStatus })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiPropertyOptional({ enum: CaseType })
  @IsOptional()
  @IsEnum(CaseType)
  type?: CaseType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
