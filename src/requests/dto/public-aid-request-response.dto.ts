import { ApiProperty } from '@nestjs/swagger';

export class PublicAidRequestCategoryDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 'Health', nullable: true })
  name!: string | null;
}

export class PublicAidRequestListItemDto {
  @ApiProperty({ example: 13 })
  id!: number;

  @ApiProperty({ type: PublicAidRequestCategoryDto })
  category!: PublicAidRequestCategoryDto;

  @ApiProperty({
    example: 'uploads/request-media/example.png',
    nullable: true,
  })
  image!: string | null;

  @ApiProperty({ example: 'Urgent surgery', nullable: true })
  title!: string | null;

  @ApiProperty({ example: '2500' })
  totalCost!: string;

  @ApiProperty({ example: '1250' })
  paidAmount!: string;

  @ApiProperty({ example: '1250' })
  remainingAmount!: string;

  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  completionPercentage!: number;

  @ApiProperty({ example: true })
  isUrgent!: boolean;
}

export class PublicAidRequestDetailDto {
  @ApiProperty({
    example: 'uploads/request-media/example.png',
    nullable: true,
  })
  image!: string | null;

  @ApiProperty({ example: 'Urgent surgery', nullable: true })
  title!: string | null;

  @ApiProperty({
    example: 'Reviewed request description',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: '2500' })
  totalCost!: string;

  @ApiProperty({ example: '1250' })
  paidAmount!: string;

  @ApiProperty({ example: '1250' })
  remainingAmount!: string;

  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  completionPercentage!: number;

  @ApiProperty({ example: true })
  isUrgent!: boolean;
}
