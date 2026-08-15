import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademicAchievement, TypeAid } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';

const validationMessage = (key: string) => ({
  message: i18nValidationMessage(key),
});

export class AdminCreateRequestBaseDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt(validationMessage('validation.isInt'))
  @Min(1, validationMessage('validation.min'))
  categoryId!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt(validationMessage('validation.isInt'))
  @Min(1, validationMessage('validation.min'))
  subCategoryId?: number;

  @ApiProperty({ example: 'Mohammad' })
  @IsString(validationMessage('validation.isString'))
  @IsNotEmpty(validationMessage('validation.isNotEmpty'))
  @MaxLength(50, validationMessage('validation.maxLength'))
  beneficiaryFatherName!: string;

  @ApiProperty({ type: BilingualTextDto })
  @IsDefined(validationMessage('validation.isNotEmpty'))
  @ParseBilingualText()
  details!: BilingualTextDto;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber({}, validationMessage('validation.isNumber'))
  @Min(0, validationMessage('validation.min'))
  cost!: number;

  @ApiProperty({ type: BilingualTextDto })
  @IsDefined(validationMessage('validation.isNotEmpty'))
  @ParseBilingualText()
  title!: BilingualTextDto;

  @ApiProperty({ type: BilingualTextDto })
  @IsDefined(validationMessage('validation.isNotEmpty'))
  @ParseBilingualText()
  description!: BilingualTextDto;

  @ApiProperty({ example: false })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsDefined(validationMessage('validation.isNotEmpty'))
  @IsBoolean(validationMessage('validation.isBoolean'))
  isUrgent!: boolean;
}

export class AdminHealthRequestDto extends AdminCreateRequestBaseDto {
  @ApiProperty({ enum: TypeAid, example: TypeAid.MEDICINE_INSURANCE })
  @IsEnum(TypeAid, validationMessage('validation.isEnum'))
  typeAid!: TypeAid;
}

export class AdminFoodRequestDto extends AdminCreateRequestBaseDto {
  @ApiProperty({ enum: TypeAid, example: TypeAid.FOOD_BASKET })
  @IsEnum(TypeAid, validationMessage('validation.isEnum'))
  typeAid!: TypeAid;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt(validationMessage('validation.isInt'))
  @Min(1, validationMessage('validation.min'))
  numberIndividuals!: number;
}

export class AdminEducationRequestDto extends AdminCreateRequestBaseDto {
  @ApiProperty({ enum: AcademicAchievement })
  @IsEnum(
    AcademicAchievement,
    validationMessage('validation.isEnum'),
  )
  academicAchievement!: AcademicAchievement;

  @ApiProperty({ type: BilingualTextDto })
  @IsDefined(validationMessage('validation.isNotEmpty'))
  @ParseBilingualText()
  institutionName!: BilingualTextDto;

  @ApiProperty({ example: '2026' })
  @IsString(validationMessage('validation.isString'))
  @IsNotEmpty(validationMessage('validation.isNotEmpty'))
  year!: string;
}

export class AdminHousingRequestDto extends AdminCreateRequestBaseDto {
  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt(validationMessage('validation.isInt'))
  @Min(1, validationMessage('validation.min'))
  declare subCategoryId: number;

  @ApiPropertyOptional({ type: BilingualTextDto })
  @IsOptional()
  @ParseBilingualText()
  currentHousingSituation?: BilingualTextDto;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, validationMessage('validation.isNumber'))
  @Min(0, validationMessage('validation.min'))
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

export class AdminSmallProjectRequestDto extends AdminCreateRequestBaseDto {
  @ApiProperty({ type: BilingualTextDto })
  @IsDefined(validationMessage('validation.isNotEmpty'))
  @ParseBilingualText()
  projectName!: BilingualTextDto;

  @ApiProperty({ type: BilingualTextDto })
  @IsDefined(validationMessage('validation.isNotEmpty'))
  @ParseBilingualText()
  projectCategory!: BilingualTextDto;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt(validationMessage('validation.isInt'))
  @Min(1, validationMessage('validation.min'))
  numberOfPeopleSupported!: number;
}
