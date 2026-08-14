import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsAscii, IsNotEmpty, IsString, MaxLength } from 'class-validator';

function trimRegistrationId(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class RegisterNotificationDto {
  @ApiProperty({
    description:
      'Firebase registration identifier for the current app or browser installation',
    example: 'firebase-registration-id',
    maxLength: 512,
  })
  @Transform(({ value }: TransformFnParams) =>
    trimRegistrationId(value as unknown),
  )
  @IsString()
  @IsNotEmpty()
  @IsAscii()
  @MaxLength(512)
  registrationId!: string;
}
