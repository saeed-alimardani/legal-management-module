import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ReassignCaseDto {
  @ApiProperty({ description: 'UUID of the new case owner' })
  @IsUUID()
  @IsNotEmpty()
  ownerId!: string;
}
