import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialStatus } from '@prisma/client'; 
import { BaseRegisterDto } from './base-register.dto';
import { Transform, Type } from 'class-transformer';

export class RegisterBeneficiaryDto extends BaseRegisterDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  @IsString()
  @IsNotEmpty()
  personalPhoto!: string;

  @ApiProperty({ type: 'string', format: 'binary' })
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
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isUnemployed!: boolean;

  @ApiProperty({ example: 500.0 })
  @ValidateIf((o) => o.isUnemployed === false) 
  @IsNotEmpty({ message: 'When employed, monthlyIncome is required.' }) 
  @Type(() => Number) 
  @IsNumber()
  monthlyIncome!: number;

  @ApiPropertyOptional({ example: 3 })
  @ValidateIf((o) => o.socialStatus !== SocialStatus.SINGLE) 
  @IsNotEmpty() 
  @Type(() => Number)
  @IsNumber()
  numberOfChildren?: number;

  // الحقول المحظورة مثل status أو rejectionReason غير موجودة هنا لضمان عدم تلاعب الـ Client بها
}
