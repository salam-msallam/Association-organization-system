import { ApiProperty } from '@nestjs/swagger';

export class CompletedAidCasesCountResponseDto {
  @ApiProperty({
    example: 87,
    description: 'Number of accepted aid requests with full funding',
  })
  completed_aid_cases_count: number;
}
