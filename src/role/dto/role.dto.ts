import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDefined,
  IsInt,
  IsOptional,
} from 'class-validator';
import {
  BilingualTextDto,
  ParseBilingualText,
} from '../../requests/dto/bilingual-text.dto';

const parseIdArray = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number) : [Number(value)];
    } catch {
      return value.split(',').map(Number);
    }
  }

  return value;
};

export class CreateRoleDto {
  @ApiProperty({
    type: BilingualTextDto,
    example: { ar: 'إدارة المالية', en: 'Finance Management' },
  })
  @IsDefined()
  @ParseBilingualText()
  label!: BilingualTextDto;

  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsDefined()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Transform(({ value }) => parseIdArray(value))
  permissionIds!: number[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({
    type: BilingualTextDto,
    example: { ar: 'إدارة المالية', en: 'Finance Management' },
  })
  @IsOptional()
  @ParseBilingualText()
  label?: BilingualTextDto;

  @ApiPropertyOptional({ type: [Number], example: [1, 2, 3] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Transform(({ value }) => parseIdArray(value))
  permissionIds?: number[];
}

export class RolePermissionResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'read:roles' })
  name!: string;
}

export class PermissionResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'read:roles' })
  name!: string;
}

export class RoleEmployeeResponseDto {
  @ApiProperty({ example: 7 })
  userId!: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Saleh' })
  lastName!: string;
}

export class RoleResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'role_manager' })
  name!: string;

  @ApiProperty({ example: 'Role Management' })
  label!: string;

  @ApiProperty({ example: '2026-07-31T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: [RolePermissionResponseDto] })
  permissions!: RolePermissionResponseDto[];

  @ApiProperty({ type: [RoleEmployeeResponseDto] })
  employees!: RoleEmployeeResponseDto[];
}

export class RoleDetailResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'role_manager' })
  name!: string;

  @ApiProperty({
    type: BilingualTextDto,
    example: { ar: 'إدارة الأدوار', en: 'Role Management' },
  })
  label!: BilingualTextDto;

  @ApiProperty({ example: '2026-07-31T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: [RolePermissionResponseDto] })
  permissions!: RolePermissionResponseDto[];

  @ApiProperty({ type: [RoleEmployeeResponseDto] })
  employees!: RoleEmployeeResponseDto[];
}
