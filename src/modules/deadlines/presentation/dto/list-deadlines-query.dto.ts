import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';
import { DeadlineView } from '../../domain/deadline-view.enum';

export class ListDeadlinesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DeadlineView,
    description:
      'upcoming | overdue | today | assigned-to-me — filters PENDING deadlines',
  })
  @IsOptional()
  @IsEnum(DeadlineView)
  view?: DeadlineView;
}
