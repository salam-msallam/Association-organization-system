import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client'; // استيراد الـ Enum من بريزما مباشرة

export class BaseRegisterDto {
  @ApiProperty({ example: 'salam' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'msallam' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'salam@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '934206455' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @ApiProperty({ example: 'syria' })
  @IsString()
  @IsNotEmpty()
  countryName!: string;

  @ApiProperty({ example: '+963' })
  @IsString()
  @IsNotEmpty()
  countryCode!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;
}