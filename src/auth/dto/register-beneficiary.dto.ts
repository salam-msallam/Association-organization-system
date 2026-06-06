import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialStatus } from '@prisma/client'; 
import { BaseRegisterDto } from './base-register.dto';
import { Type } from 'class-transformer';

export class RegisterBeneficiaryDto extends BaseRegisterDto {
  @ApiProperty({ example: 'https://example.com/photo.jpg' })
  @IsString()
  @IsNotEmpty()
  personalPhoto!: string;

  @ApiProperty({ example: 'https://example.com/family-statement.pdf' })
  @IsString()
  @IsNotEmpty()
  familyStatement!: string;

  @ApiProperty({ example: 'Mezzeh' }) 
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ enum: SocialStatus, example: SocialStatus.WIDOWED })
  @IsEnum(SocialStatus)
  socialStatus!: SocialStatus;

  @ApiProperty({ example: true })
  @IsBoolean()
  isUnemployed!: boolean;

  @ApiProperty({ example: 500.0 })
  @Type(() => Number) 
  @IsNumber()
  monthlyIncome!: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numberOfChildren?: number;

  // الحقول المحظورة مثل status أو rejectionReason غير موجودة هنا لضمان عدم تلاعب الـ Client بها
}