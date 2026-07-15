import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';
import { ReminderView } from '../../domain/reminder-view.enum';

export class ListRemindersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ReminderView,
    description:
      'upcoming | due | sent | assigned-to-me — filters reminders by status and timing',
  })
  @IsOptional()
  @IsEnum(ReminderView)
  view?: ReminderView;
}
