import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialStatus } from '@prisma/client';
import { BaseRegisterDto } from './base-register.dto';
import { Transform, Type } from 'class-transformer';

export class RegisterBeneficiaryDto extends BaseRegisterDto {
  @ApiProperty({ example: '+963' })
  @Equals('+963', {
    message: 'validation.BENEFICIARY_COUNTRY_CODE_MUST_BE_SYRIA',
  })
  declare countryCode: string;

  @ApiProperty({
    type: 'string',
    format: 'date',
    example: '1990-05-20',
  })
  @IsDateString({}, { message: 'validation.INVALID_DATE_OF_BIRTH' })
  dateOfBirth!: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  @IsString()
  @IsOptional()
  personalPhoto!: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  @IsString()
  @IsOptional()
  familyStatement!: string;

  @ApiProperty({ example: '{"ar":"مزة","en":"mezzeh"}' })
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ enum: SocialStatus, example: SocialStatus.WIDOWED })
  @IsEnum(SocialStatus)
  socialStatus!: SocialStatus;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isUnemployed!: boolean;

  @ApiPropertyOptional({ example: 500.0 })
  @ValidateIf((o) => o.isUnemployed === false)
  @IsNotEmpty({ message: 'validation.MONTHLY_INCOME_REQUIRED_WHEN_EMPLOYED' })
  @Type(() => Number)
  @IsNumber()
  monthlyIncome?: number;

  @ApiPropertyOptional({ example: 3 })
  @ValidateIf((o) => o.socialStatus !== SocialStatus.SINGLE)
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  numberOfChildren?: number;

  // الحقول المحظورة مثل status أو rejectionReason غير موجودة هنا لضمان عدم تلاعب الـ Client بها
}
