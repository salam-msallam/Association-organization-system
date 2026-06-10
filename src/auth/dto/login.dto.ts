// src/auth/dto/login.dto.ts
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Please enter a valid phone number' })
  phoneNumber!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}