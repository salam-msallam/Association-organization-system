import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordResetDto {
  @ApiProperty({ example: '1234' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'validation.OTP_CODE_MUST_BE_4_DIGITS' })
  code!: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsNotEmpty({ message: 'validation.PASSWORD_REQUIRED' })
  @IsString()
  @MinLength(6, { message: 'validation.PASSWORD_MIN_LENGTH' })
  newPassword!: string;
}
