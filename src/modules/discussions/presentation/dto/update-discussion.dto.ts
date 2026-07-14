import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDiscussionDto {
  @ApiProperty({ example: 'Updated discussion content.' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
