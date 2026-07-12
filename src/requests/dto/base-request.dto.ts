import {
  IsString,
  IsInt,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';
import { SocialStatus, Gender } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';
import { IsDefined } from 'class-validator';


export class BaseRequestAidDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  subCategoryId?: number;

  @ApiProperty({ example: 'Ahmad' })
  @IsString()
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  @IsString()
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ example: 'Mohammad' })
  @IsString()
  @MaxLength(50)
  beneficiaryFatherName!: string;

  @ApiProperty({ enum: SocialStatus, example: SocialStatus.WIDOWED })
  @IsEnum(SocialStatus)
  socialStatus!: SocialStatus;

  @ApiProperty({
    type: BilingualTextDto,
    example: { ar: 'دمشق - المزة', en: 'Damascus - Al Mazzeh' },
  })
  @IsDefined({ message: 'address is required' })
  @ParseBilingualText()
  address!: BilingualTextDto;

  @ApiProperty({ example: 35 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  age!: number;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isUnemployed!: boolean;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: '0999999999' })
  @IsString()
  @MaxLength(20)
  number!: string;

  @ApiProperty({
    type: BilingualTextDto,
    example: {
      ar: 'بحاجة إلى دعم دوائي للعلاج الشهري',
      en: 'Need medicine support for monthly treatment',
    },
  })
  @ParseBilingualText()
  details!: BilingualTextDto;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost!: number;
}
