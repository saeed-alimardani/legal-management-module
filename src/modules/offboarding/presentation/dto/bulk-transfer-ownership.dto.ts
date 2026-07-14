import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class BulkTransferOwnershipDto {
  @ApiProperty({
    description: 'UUID of the departing user whose work is transferred',
  })
  @IsUUID()
  @IsNotEmpty()
  fromUserId!: string;

  @ApiProperty({ description: 'UUID of the receiving user' })
  @IsUUID()
  @IsNotEmpty()
  toUserId!: string;
}
