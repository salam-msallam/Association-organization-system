import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginClientDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'validation.VALID_PHONE_NUMBER' })
  phoneNumber!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}
