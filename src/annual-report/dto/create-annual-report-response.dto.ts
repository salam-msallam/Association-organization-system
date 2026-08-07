import { ApiProperty } from '@nestjs/swagger';

export class AnnualReportDataDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 5 })
  sponsorshipId!: number;

  @ApiProperty({ example: 3 })
  orphanId!: number;

  @ApiProperty({ example: 2 })
  employeeId!: number;

  @ApiProperty({ example: 1 })
  reportNumber!: number;

  @ApiProperty({
    example: {
      ar: 'uploads/annual-reports/report-ar.jpg',
      en: 'uploads/annual-reports/report-en.jpg',
    },
  })
  mediaUrl!: { ar: string; en: string };

  @ApiProperty({ example: '2027-08-12T10:00:00.000Z' })
  createdAt!: Date;
}

export class CreateAnnualReportResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'The annual report was saved successfully.' })
  message!: string;

  @ApiProperty({ type: AnnualReportDataDto })
  data!: AnnualReportDataDto;
}
