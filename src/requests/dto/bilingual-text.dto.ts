import { Transform, plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BilingualTextDto {
  @ApiProperty({ example: 'دمشق - المزة' })
  @IsString()
  @IsNotEmpty()
  ar: string;

  @ApiProperty({ example: 'Damascus - Al Mazzeh' })
  @IsString()
  @IsNotEmpty()
  en: string;
}

export function ParseBilingualText() {
  return function (target: object, propertyKey: string) {
    Transform(({ value }) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      let parsedValue = value;

      if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (!trimmedValue) return undefined;

        try {
          parsedValue = JSON.parse(trimmedValue);
        } catch {
          return value;
        }
      }

      return plainToInstance(BilingualTextDto, parsedValue);
    })(target, propertyKey);

    ValidateNested()(target, propertyKey);
  };
}