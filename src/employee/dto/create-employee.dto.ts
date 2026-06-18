// src/employee/dto/create-employee.dto.ts
import { IsEmail, IsString, IsEnum, IsInt, IsNotEmpty, IsDateString, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

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
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  @IsNotEmpty()
  personalPhoto: string;

  @IsDateString({},{message: 'The date of birth must be YY-MM-dd' })
  dateOfBirth: string;

  @IsInt()
  @IsNotEmpty()
  roleId: number;
}