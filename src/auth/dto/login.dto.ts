import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@gmail.com', description: 'البريد الإلكتروني للمستخدِم' })
  @IsEmail({}, { message: 'validation.EMAIL_MUST_BE_VALID' })
  @IsNotEmpty({ message: 'validation.EMAIL_REQUIRED' })
  email: string;

  @ApiProperty({ example: 'password', description: 'كلمة المرور' })
  @IsNotEmpty({ message: 'validation.PASSWORD_REQUIRED' })
  @MinLength(6, { message: 'validation.PASSWORD_MIN_LENGTH' })
  password: string;
}
