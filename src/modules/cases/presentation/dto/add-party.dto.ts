import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartyType } from '../../domain/party-type.enum';

export class AddPartyDto {
  @ApiProperty({ example: 'Beta LLC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: PartyType, example: PartyType.PLAINTIFF })
  @IsEnum(PartyType)
  partyType!: PartyType;

  @ApiPropertyOptional({ example: 'contact@beta.com' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contactInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
