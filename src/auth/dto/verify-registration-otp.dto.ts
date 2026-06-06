import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyRegistrationOtpDto {
  @ApiProperty({ example: '+963' })
  @IsString()
  @IsNotEmpty()
  countryCode!: string;

  @ApiProperty({ example: '771234567' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @ApiProperty({ example: '1234', description: 'يجب أن يتكون رمز الـ OTP من 4 أرقام تماماً' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'OTP code must be exactly 4 digits' })
  code!: string;
}