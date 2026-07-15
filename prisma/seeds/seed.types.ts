import {
  Gender,
  Permission,
  Prisma,
  Role,
  SocialStatus,
  Status,
} from '@prisma/client';

export type PermissionMap = Record<string, Permission>;

export interface SeededRoles {
  employeeManagerRole: Role;
  donorReaderRole: Role;
  roleManagerRole: Role;
  aidRequestManagerRole: Role;
}

export interface SeededCategories {
  healthCategoryId: number;
  foodCategoryId: number;
  housingCategoryId: number;
  educationCategoryId: number;
  smallProjectsCategoryId: number;
}

export interface SeededSubCategories {
  rentAssistanceSubCategoryId: number;
  homeRepairsSubCategoryId: number;
}

export interface SeededBeneficiaryAccount {
  email: string;
  password: string;
  status: Status;
}

export interface AcceptedBeneficiary {
  id: number;
  address: Prisma.JsonValue;
  socialStatus: SocialStatus;
  isUnemployed: boolean;
  user: {
    firstName: string;
    lastName: string;
    gender: Gender;
  };
}

export interface SeededBeneficiaries {
  accounts: SeededBeneficiaryAccount[];
  acceptedBeneficiaries: AcceptedBeneficiary[];
}
