import { ApiProperty } from '@nestjs/swagger';

class DonorAnnualReportItemDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 2 })
  reportNumber!: number;

  @ApiProperty({ example: 2027 })
  reportYear!: number;

  @ApiProperty({
    example: 'uploads/annual-reports/report-ar-2.jpg',
    description: 'Localized report image selected using accept-language.',
  })
  imageUrl!: string;

  @ApiProperty({ example: '2027-06-01T10:00:00.000Z' })
  createdAt!: Date;
}

export class DonorAnnualReportsResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'تم جلب التقارير السنوية بنجاح.' })
  message!: string;

  @ApiProperty({ type: [DonorAnnualReportItemDto] })
  data!: DonorAnnualReportItemDto[];
}
