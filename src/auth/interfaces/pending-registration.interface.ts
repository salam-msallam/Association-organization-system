import { RegisterDonorDto } from '../dto/register-donor.dto';
import { RegisterBeneficiaryDto } from '../dto/register-beneficiary.dto';

export type UserType = 'DONOR' | 'BENEFICIARY';

export interface PendingRegistrationCache {
  type: UserType;
  data: RegisterDonorDto | RegisterBeneficiaryDto;
  createdAt: string;
}