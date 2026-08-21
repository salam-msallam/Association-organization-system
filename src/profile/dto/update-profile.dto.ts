import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, SocialStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  BilingualTextDto,
  ParseBilingualText,
} from '../../requests/dto/bilingual-text.dto';
import {
  IsDateOfBirthNotInFuture,
  IsDateOfBirthWithinYears,
} from '../../decorators/date-of-birth.decorator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ahmad' })
  @IsOptional()
  @IsString()
  @Transform(emptyToUndefined)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Ali' })
  @IsOptional()
  @IsString()
  @Transform(emptyToUndefined)
  lastName?: string;

  @ApiPropertyOptional({ example: 'ahmad@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'validation.EMAIL_MUST_BE_VALID' })
  @Transform(emptyToUndefined)
  email?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender)
  @Transform(emptyToUndefined)
  gender?: Gender;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Optional profile photo upload for employees and beneficiaries only.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  personalPhoto?: unknown;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    example: '1994-04-18',
  })
  @IsOptional()
  @IsDateString({}, { message: 'validation.INVALID_DATE_OF_BIRTH' })
  @IsDateOfBirthNotInFuture({
    message: 'validation.DATE_OF_BIRTH_CANNOT_BE_IN_FUTURE',
  })
  @IsDateOfBirthWithinYears(100, {
    message: 'validation.DATE_OF_BIRTH_EXCEEDS_MAX_AGE',
  })
  @Transform(emptyToUndefined)
  dateOfBirth?: string;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    example: { ar: 'دمشق - المزة', en: 'Damascus - Al Mazzeh' },
  })
  @IsOptional()
  @ParseBilingualText()
  address?: BilingualTextDto;

  @ApiPropertyOptional({ enum: SocialStatus, example: SocialStatus.SINGLE })
  @IsOptional()
  @IsEnum(SocialStatus)
  @Transform(emptyToUndefined)
  socialStatus?: SocialStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  isUnemployed?: boolean;
}
