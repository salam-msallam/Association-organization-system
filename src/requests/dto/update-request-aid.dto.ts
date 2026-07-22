import {
  AcademicAchievement,
  Gender,
  SocialStatus,
  TypeAid,
} from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';

function emptyStringToUndefined({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return input === '' ? undefined : input;
}

function optionalNumber({ value }: TransformFnParams): unknown {
  const input: unknown = value;

  if (input === '' || input === undefined || input === null) {
    return undefined;
  }

  return typeof input === 'number' ? input : Number(input);
}

function optionalBoolean({ value }: TransformFnParams): unknown {
  const input: unknown = value;

  if (input === '' || input === undefined || input === null) {
    return undefined;
  }

  return input === true || input === 'true';
}

export class UpdateRequestAidDto {
  @ApiPropertyOptional({ example: 'Ahmad' })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Ali' })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Mohammad' })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  beneficiaryFatherName?: string;

  @ApiPropertyOptional({ enum: SocialStatus })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsEnum(SocialStatus)
  socialStatus?: SocialStatus;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  address?: BilingualTextDto;

  @ApiPropertyOptional({ example: 35 })
  @Transform(optionalNumber)
  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({ example: true })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean()
  isUnemployed?: boolean;

  @ApiPropertyOptional({ enum: Gender })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '0999999999' })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  details?: BilingualTextDto;

  @ApiPropertyOptional({ example: 100 })
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  // ---- الحقول الخاصة بكل فئة (Education/Food/Housing/SmallProjects) ----

  @ApiPropertyOptional({ enum: AcademicAchievement })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsEnum(AcademicAchievement)
  academicAchievement?: AcademicAchievement;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  institutionName?: BilingualTextDto;

  @ApiPropertyOptional({ example: '2026' })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional({ enum: TypeAid })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsEnum(TypeAid)
  typeAid?: TypeAid;

  @ApiPropertyOptional({ example: 5 })
  @Transform(optionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  numberIndividuals?: number;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  projectName?: BilingualTextDto;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  projectCategory?: BilingualTextDto;

  @ApiPropertyOptional({ example: 3 })
  @Transform(optionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfPeopleSupported?: number;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  currentHousingSituation?: BilingualTextDto;

  @ApiPropertyOptional({ example: 250 })
  @Transform(optionalNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentRent?: number;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  currentPlaceOfResidence?: BilingualTextDto;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  reasonForLock?: BilingualTextDto;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  housingSpecifications?: BilingualTextDto;
}