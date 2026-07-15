import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NoticeStatus } from '../../domain/notice-status.enum';

export class CreateNoticeDto {
  @ApiProperty({ example: 'Demand letter from Vendor X' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ example: 'Vendor X Legal Dept' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sender!: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  receivedDate!: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  responseDeadline!: string;

  @ApiPropertyOptional({
    enum: NoticeStatus,
    default: NoticeStatus.RECEIVED,
  })
  @IsOptional()
  @IsEnum(NoticeStatus)
  status?: NoticeStatus;

  @ApiPropertyOptional({
    description: 'Only admins and managers may assign a different owner',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedCaseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedContractId?: string;
}
