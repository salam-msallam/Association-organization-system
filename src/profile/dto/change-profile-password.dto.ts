import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangeProfilePasswordDto {
  @ApiProperty({ example: 'password123' })
  @IsNotEmpty({ message: 'validation.PASSWORD_REQUIRED' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'new-password123', minLength: 6 })
  @IsNotEmpty({ message: 'validation.PASSWORD_REQUIRED' })
  @IsString()
  @MinLength(6, { message: 'validation.PASSWORD_MIN_LENGTH' })
  newPassword!: string;

  @ApiProperty({ example: 'new-password123', minLength: 6 })
  @IsNotEmpty({ message: 'validation.PASSWORD_REQUIRED' })
  @IsString()
  @MinLength(6, { message: 'validation.PASSWORD_MIN_LENGTH' })
  confirmPassword!: string;
}
