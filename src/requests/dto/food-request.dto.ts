import {
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { TypeAid } from '@prisma/client';
import { BaseRequestAidDto } from './base-request.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';


export class FoodRequestDto extends BaseRequestAidDto {
  @ApiProperty({ enum: TypeAid, example: TypeAid.FOOD_BASKET })
  @IsEnum(TypeAid)
  typeAid!: TypeAid;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberIndividuals: number;
}
