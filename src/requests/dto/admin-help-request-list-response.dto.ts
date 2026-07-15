import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class AdminHelpRequestListItemDto {
  @ApiProperty({ example: 13 })
  id: number;

  @ApiProperty({ example: 'Beneficiary9' })
  firstName: string;

  @ApiProperty({ example: 'Test' })
  lastName: string;

  @ApiProperty({ enum: Status, example: Status.ACCEPTED })
  status: Status;

  @ApiProperty({
    example: 'SURGERY',
    nullable: true,
    description:
      'AidDetails type when available; otherwise the translated category name',
  })
  typeAid: string | null;

  @ApiProperty({ example: true })
  isUrgent: boolean;

  @ApiProperty({ example: '2500' })
  cost: string;

  @ApiProperty({ example: '1250' })
  currentPayment: string;

  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  compliancePercentage: number;
}

export class AdminHelpRequestListMetaDto {
  @ApiProperty({ example: 25 })
  totalCount: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;
}

export class AdminHelpRequestListResponseDto {
  @ApiProperty({ type: [AdminHelpRequestListItemDto] })
  data: AdminHelpRequestListItemDto[];

  @ApiProperty({ type: AdminHelpRequestListMetaDto })
  meta: AdminHelpRequestListMetaDto;
}
