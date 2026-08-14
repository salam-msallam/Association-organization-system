import { Gender, SocialStatus, UserType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class EmployeeProfileRoleDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'employee_manager' })
  name!: string;

  @ApiProperty({
    example: 'مدير الموظفين',
    description:
      'Localized according to Accept-Language. Arabic is used by default.',
  })
  label!: string;
}

export class EmployeeProfileResponseDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Ahmad Ali' })
  fullName!: string;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  lastName!: string;

  @ApiProperty({ example: 'ahmad@example.com' })
  email!: string;

  @ApiProperty({ example: '+963' })
  countryCode!: string;

  @ApiProperty({ example: '934206455' })
  number!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  gender!: Gender;

  @ApiProperty({ enum: UserType, example: UserType.EMPLOYEE })
  userType!: UserType;

  @ApiProperty({
    example: 'https://charity.example.com/uploads/employees/photo.jpg',
  })
  personalPhoto!: string;

  @ApiProperty({
    example: '1994-04-18',
    description: 'Date of birth in YYYY-MM-DD format.',
  })
  dateOfBirth!: string;

  @ApiProperty({ type: [EmployeeProfileRoleDto] })
  roles!: EmployeeProfileRoleDto[];
}

export class BeneficiaryProfileResponseDto {
  @ApiProperty({})
  fullName!: string;

  @ApiProperty({ example: 'beneficiary@example.com' })
  email!: string;

  @ApiProperty({ example: '+963' })
  countryCode!: string;

  @ApiProperty({})
  age!: number | null;

  @ApiProperty({})
  socialStatus!: SocialStatus;

  @ApiProperty({})
  address!: unknown;

  @ApiProperty({})
  number!: string;

  @ApiProperty({})
  gender!: Gender;

  @ApiProperty({})
  isUnemployed!: boolean;

  @ApiProperty({})
  personalPhoto!: string;
}

export class DonorProfileResponseDto {
  @ApiProperty({ example: 'Ahmad Ali' })
  fullName!: string;

  @ApiProperty({ example: 'ahmad@example.com' })
  email!: string;

  @ApiProperty({ example: '+963' })
  countryCode!: string;

  @ApiProperty({ example: '934206455' })
  number!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  gender!: Gender;

  @ApiProperty({ example: 150.5 })
  walletBalance!: number;

  @ApiProperty({ example: true })
  isSponsor!: boolean;

  @ApiProperty({ example: 1250 })
  totalDonated!: number;
}
