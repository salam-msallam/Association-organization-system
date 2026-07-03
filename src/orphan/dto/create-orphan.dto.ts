import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '@prisma/client';

export class CreateOrphanDto {
  @ApiProperty({ example: 'Ahmad' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Hassan' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'Mohammad' })
  @IsString()
  @IsNotEmpty()
  fatherName!: string;

  @ApiProperty({ example: 'Fatima' })
  @IsString()
  @IsNotEmpty()
  motherName!: string;

  @ApiProperty({ example: '2015-04-12', format: 'date' })
  @IsDateString()
  birthOfDate!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: '{"ar":"الصف الرابع","en":"Fourth grade"}' })
  @IsNotEmpty()
  class: any;

  @ApiProperty({
    example:
      '{"ar":"لا توجد أمراض","en":"No diseases"}',
  })
  @IsNotEmpty()
  Diseases: any;

  @ApiProperty({ example: 3 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  brotherAndSisterNumber!: number;

  @ApiProperty({ example: 'Mahmoud Hassan' })
  @IsString()
  @IsNotEmpty()
  guardianName!: string;

  @ApiProperty({ example: '+963933123456' })
  @IsString()
  @IsNotEmpty()
  guaranteedPhone!: string;

  @ApiProperty({ example: 130 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  bodySize!: number;

  @ApiProperty({ example: 34 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  shoesSize!: number;

  @ApiProperty({
    example:
      '{"ar":"دمشق","en":"Damascus"}',
  })
  @IsNotEmpty()
  currentAddress: any;

  @ApiProperty({
    example:
      '{"ar":"حمص","en":"Homs"}',
  })
  @IsNotEmpty()
  previousAddress: any;

  @ApiProperty({ example: '{"ar":"الرسم","en":"Drawing"}' })
  @IsNotEmpty()
  talent: any;

  @ApiPropertyOptional({ example: false, default: false })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isSupported?: boolean;

  @ApiProperty({ type: 'string', format: 'binary' })
  FamilyStatement?: string;
}
