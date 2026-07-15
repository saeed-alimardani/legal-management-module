import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ReassignNoticeDto {
  @ApiProperty({ description: 'UUID of the new notice owner' })
  @IsUUID()
  @IsNotEmpty()
  ownerId!: string;
}
