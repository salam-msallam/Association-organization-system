import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+\d{1,4}$/, { message: 'validation.INVALID_COUNTRY_CODE' })
  countryCode!: string; // مثال: +963

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{7,15}$/)
  number!: string; // مثال: 933333333

  @IsNotEmpty()
  @IsString()
  @Length(4)
  code!: string;
}