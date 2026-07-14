import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';
import { FinancialRecordType } from '../../domain/financial-record-type.enum';

export class ListFinancialRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional({ enum: FinancialRecordType })
  @IsOptional()
  @IsEnum(FinancialRecordType)
  type?: FinancialRecordType;
}
