import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ReassignContractDto {
  @ApiProperty({ description: 'UUID of the new contract owner' })
  @IsUUID()
  @IsNotEmpty()
  ownerId!: string;
}
