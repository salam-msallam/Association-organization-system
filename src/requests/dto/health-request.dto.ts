import { IsEnum } from 'class-validator';
import { TypeAid } from '@prisma/client';
import { BaseRequestAidDto } from './base-request.dto';
import { ApiProperty } from '@nestjs/swagger';



export class HealthRequestDto extends BaseRequestAidDto {
  @ApiProperty({ enum: TypeAid, example: TypeAid.MEDICINE_INSURANCE })
  @IsEnum(TypeAid)
  typeAid: TypeAid;
}
