import { IsEmail, IsString, IsEnum, IsOptional, IsDateString, IsArray, IsNumber } from 'class-validator';
import { Gender } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateEmployeeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === '' ? undefined : value) 
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === '' ? undefined : value) 
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'email must be an email' })
  @Transform(({ value }) => value === '' ? undefined : value) 
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === '' ? undefined : value) 
  number?: string;

  @ApiProperty({ required: false, enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  @Transform(({ value }) => value === '' ? undefined : value)
  gender?: Gender;

  @ApiProperty({
    type: 'string',
    format: 'binary', 
    description: 'الصورة الشخصية للموظف (اختياري)',
    required: false
  })
  @IsOptional()
  personalPhoto?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString({}, { message: 'The date of birth must be YY-MM-dd' })
  @Transform(({ value }) => value === '' ? undefined : value)
  dateOfBirth?: string;

  @ApiProperty({
    type: 'string',
    description: 'أرقام الأدوار الجديدة ممررة كمصفوفة نصية مثل [1,2] (اختياري)',
    example: '[1,2]',
    required: false
  })
  @IsOptional()
  @IsArray({ message: 'roleIds يجب أن تكون مصفوفة' })
  @IsNumber({}, { each: true, message: 'كل عنصر في roleIds يجب أن يكون رقماً' })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(Number) : [Number(value)];
      } catch {
        return value.split(',').map(Number);
      }
    }
    return value;
  })
  roleIds?: number[];
}