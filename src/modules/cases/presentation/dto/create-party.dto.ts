import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PartyType } from '../../domain/party-type.enum';

export class CreatePartyDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: PartyType, example: PartyType.DEFENDANT })
  @IsEnum(PartyType)
  partyType!: PartyType;

  @ApiPropertyOptional({ example: 'legal@acme.com' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contactInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
