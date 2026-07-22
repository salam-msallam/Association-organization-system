import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ForgotPasswordRequestOtpDto {
  @ApiProperty({ example: '+963934206455' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'validation.VALID_PHONE_NUMBER' })
  phoneNumber!: string;
}
