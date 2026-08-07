import { ApiProperty } from '@nestjs/swagger';

export class DashboardUsersCountResponseDto {
  @ApiProperty({
    example: 325,
    description: 'Total number of donor accounts',
  })
  donors_count: number;

  @ApiProperty({
    example: 128,
    description: 'Total number of beneficiary accounts',
  })
  beneficiaries_count: number;
}
