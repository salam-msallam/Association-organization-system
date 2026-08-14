import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsAscii,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

function trimRegistrationId(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

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

  @ApiPropertyOptional({
    description:
      'Firebase registration identifier for the current Flutter installation',
    example: 'firebase-registration-id',
    maxLength: 512,
  })
  @Transform(({ value }: TransformFnParams) =>
    trimRegistrationId(value as unknown),
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsAscii()
  @MaxLength(512)
  registrationId?: string;
}
