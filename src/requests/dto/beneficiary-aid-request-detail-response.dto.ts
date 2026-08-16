import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AcademicAchievement,
  Gender,
  SocialStatus,
  Status,
  TypeAid,
} from '@prisma/client';

export class BeneficiaryAidRequestCategoryDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'صحي' })
  name!: string | null;
}

export class BeneficiaryAidRequestDetailsDto {
  @ApiPropertyOptional({ enum: AcademicAchievement })
  academicAchievement?: AcademicAchievement;

  @ApiPropertyOptional({ example: 'جامعة دمشق' })
  institutionName?: string;

  @ApiPropertyOptional({ example: '2026' })
  year?: string;

  @ApiPropertyOptional({ example: 6 })
  numberIndividuals?: number;

  @ApiPropertyOptional({ example: 'مشروع خياطة' })
  projectName?: string;

  @ApiPropertyOptional({ example: 'مشروع إنتاجي' })
  projectCategory?: string;

  @ApiPropertyOptional({ example: 5 })
  numberOfPeopleSupported?: number;

  @ApiPropertyOptional({ example: 'منزل مستأجر' })
  currentHousingSituation?: string;

  @ApiPropertyOptional({ enum: TypeAid })
  typeAid?: TypeAid;

  @ApiPropertyOptional({ example: '200.00' })
  currentRent?: string;

  @ApiPropertyOptional({ example: 'دمشق' })
  currentPlaceOfResidence?: string;

  @ApiPropertyOptional({ example: 'تراكم الإيجار' })
  reasonForLock?: string;

  @ApiPropertyOptional({ example: 'غرفتان وصالون' })
  housingSpecifications?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['uploads/request-media/document.png'],
  })
  mediaUrls?: string[];

  @ApiPropertyOptional({
    example: 'uploads/request-media/donor-facing.png',
  })
  donorImageUrl?: string;
}

export class BeneficiaryAidRequestDetailResponseDto {
  @ApiProperty({ example: 13 })
  id!: number;

  @ApiProperty({ example: 2 })
  categoryId!: number;

  @ApiProperty({ example: 7, nullable: true })
  subCategoryId!: number | null;

  @ApiProperty({ example: 'سارة' })
  firstName!: string;

  @ApiProperty({ example: 'أحمد' })
  lastName!: string;

  @ApiProperty({ example: 'محمد' })
  beneficiaryFatherName!: string;

  @ApiProperty({ enum: SocialStatus })
  socialStatus!: SocialStatus;

  @ApiProperty({ example: 'دمشق' })
  address!: string | null;

  @ApiProperty({ example: 35 })
  age!: number;

  @ApiProperty({ example: false })
  isUnemployed!: boolean;

  @ApiProperty({ enum: Gender })
  gender!: Gender;

  @ApiProperty({ example: '0991000000' })
  number!: string;

  @ApiProperty({ example: 'طلب عملية جراحية', nullable: true })
  title!: string | null;

  @ApiProperty({ example: 'تفاصيل الطلب' })
  details!: string | null;

  @ApiProperty({ example: 'وصف يظهر بعد قبول الطلب', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '2500.00' })
  cost!: string;

  @ApiProperty({ example: '1250.00' })
  currentPayment!: string;

  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  compliancePercentage!: number;

  @ApiProperty({ enum: Status })
  status!: Status;

  @ApiProperty({ example: 'الوثائق غير مكتملة', nullable: true })
  rejectionReason!: string | null;

  @ApiProperty({ example: true })
  isUrgent!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: BeneficiaryAidRequestCategoryDto })
  category!: BeneficiaryAidRequestCategoryDto;

  @ApiProperty({
    type: BeneficiaryAidRequestCategoryDto,
    nullable: true,
  })
  subCategory!: BeneficiaryAidRequestCategoryDto | null;

  @ApiProperty({ type: BeneficiaryAidRequestDetailsDto })
  aidDetails!: BeneficiaryAidRequestDetailsDto;
}
