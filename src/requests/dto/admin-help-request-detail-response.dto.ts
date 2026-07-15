import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AcademicAchievement,
  Gender,
  SocialStatus,
  Status,
  TypeAid,
} from '@prisma/client';

export class BilingualTextResponseDto {
  @ApiProperty({ example: 'دمشق' })
  ar!: string;

  @ApiProperty({ example: 'Damascus' })
  en!: string;
}

export class AdminHelpRequestCategoryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ type: BilingualTextResponseDto })
  name!: BilingualTextResponseDto;
}

export class AdminHelpRequestAidDetailsDto {
  @ApiPropertyOptional({ enum: AcademicAchievement })
  academicAchievement?: AcademicAchievement;

  @ApiPropertyOptional({ type: BilingualTextResponseDto })
  institutionName?: BilingualTextResponseDto;

  @ApiPropertyOptional({ example: '2026' })
  year?: string;

  @ApiPropertyOptional({ example: 6 })
  numberIndividuals?: number;

  @ApiPropertyOptional({ type: BilingualTextResponseDto })
  projectName?: BilingualTextResponseDto;

  @ApiPropertyOptional({ type: BilingualTextResponseDto })
  projectCategory?: BilingualTextResponseDto;

  @ApiPropertyOptional({ example: 5 })
  numberOfPeopleSupported?: number;

  @ApiPropertyOptional({ type: BilingualTextResponseDto })
  currentHousingSituation?: BilingualTextResponseDto;

  @ApiPropertyOptional({ enum: TypeAid })
  typeAid?: TypeAid;

  @ApiPropertyOptional({ example: '200.00' })
  currentRent?: string;

  @ApiPropertyOptional({ type: BilingualTextResponseDto })
  currentPlaceOfResidence?: BilingualTextResponseDto;

  @ApiPropertyOptional({ type: BilingualTextResponseDto })
  reasonForLock?: BilingualTextResponseDto;

  @ApiPropertyOptional({ type: BilingualTextResponseDto })
  housingSpecifications?: BilingualTextResponseDto;

  @ApiPropertyOptional({
    type: [String],
    example: ['http://localhost:3000/uploads/request-media/example.png'],
  })
  mediaUrls?: string[];
}

export class AdminHelpRequestDetailDto {
  @ApiProperty({ example: 13 })
  id!: number;

  @ApiProperty({ example: 'Mona' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  lastName!: string;

  @ApiProperty({ example: 'Hassan' })
  beneficiaryFatherName!: string;

  @ApiProperty({ enum: SocialStatus })
  socialStatus!: SocialStatus;

  @ApiProperty({ type: BilingualTextResponseDto })
  address!: BilingualTextResponseDto;

  @ApiProperty({ example: 35 })
  age!: number;

  @ApiProperty({ example: false })
  isUnemployed!: boolean;

  @ApiProperty({ enum: Gender })
  gender!: Gender;

  @ApiProperty({ example: '991000001' })
  number!: string;

  @ApiProperty({ type: BilingualTextResponseDto, nullable: true })
  title!: BilingualTextResponseDto | null;

  @ApiProperty({ type: BilingualTextResponseDto })
  details!: BilingualTextResponseDto;

  @ApiProperty({ type: BilingualTextResponseDto, nullable: true })
  description!: BilingualTextResponseDto | null;

  @ApiProperty({ example: '2500.00' })
  cost!: string;

  @ApiProperty({ example: '1250.00' })
  currentPayment!: string;

  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  compliancePercentage!: number;

  @ApiProperty({ enum: Status })
  status!: Status;

  @ApiProperty({ type: BilingualTextResponseDto, nullable: true })
  rejectionReason!: BilingualTextResponseDto | null;

  @ApiProperty({ example: true })
  isUrgent!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: AdminHelpRequestCategoryDto })
  category!: AdminHelpRequestCategoryDto;

  @ApiProperty({ type: AdminHelpRequestCategoryDto, nullable: true })
  subCategory!: AdminHelpRequestCategoryDto | null;

  @ApiProperty({ type: AdminHelpRequestAidDetailsDto })
  aidDetails!: AdminHelpRequestAidDetailsDto;
}

export class AdminHelpRequestDetailResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Assistance request fetched successfully.' })
  message!: string;

  @ApiProperty({ type: AdminHelpRequestDetailDto })
  data!: AdminHelpRequestDetailDto;
}
