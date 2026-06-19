import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseRegisterDto } from './base-register.dto';

export class RegisterDonorDto extends BaseRegisterDto {
  @ApiPropertyOptional({ example: '12345' })
  @IsString()
  @IsOptional()
  zipCode?: string;

  // الحقول الأخرى مثل stripeCustomerId و wallet لن نضعها هنا لكي لا يقبلها الكلاس من الـ Client
}