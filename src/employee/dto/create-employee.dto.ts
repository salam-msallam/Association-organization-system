import { IsEmail, IsString, IsEnum, IsNotEmpty, IsDateString, IsArray, IsNumber } from 'class-validator';
import { Gender } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({
    type: 'string',
    format: 'binary', 
    description: 'الصورة الشخصية للموظف',
  })
  personalPhoto: any;

  @IsDateString({},{message: 'The date of birth must be YY-MM-dd' })
  dateOfBirth: string;

  @ApiProperty({
    type: 'string', 
    description: 'أرقام الأدوار ممررة كمصفوفة نصية مثل [1,2]',
    example: '[1,2]'
  })
  @IsArray({ message: 'roleIds يجب أن تكون مصفوفة' })
  @IsNumber({}, { each: true, message: 'كل عنصر في roleIds يجب أن يكون رقماً' })
  @IsNotEmpty()
  @Transform(({ value }) => {
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
  roleIds: number[];
}