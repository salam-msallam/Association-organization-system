import { ApiProperty } from '@nestjs/swagger';

export class HelpRequestStatsResponseDto {
  @ApiProperty({
    example: 114,
    description: 'Number of pending assistance requests',
  })
  pending_count: number;

  @ApiProperty({
    example: 142,
    description: 'Number of accepted assistance requests',
  })
  accepted_count: number;

  @ApiProperty({
    example: 28,
    description: 'Number of rejected assistance requests',
  })
  rejected_count: number;

  @ApiProperty({
    example: 10,
    description: 'Number of cancelled assistance requests',
  })
  cancelled_count: number;

  @ApiProperty({
    example: 50,
    description: 'Number of accepted requests marked as urgent',
  })
  urgent_cases: number;

  @ApiProperty({
    example: 4.2,
    description:
      'Average days between creation and final review for accepted urgent requests',
  })
  avg_review_time_days: number;
}
