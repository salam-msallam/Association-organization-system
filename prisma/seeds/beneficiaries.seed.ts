import {
  Gender,
  Prisma,
  PrismaClient,
  SocialStatus,
  Status,
  UserType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  TEST_FAMILY_STATEMENT_PATH,
  TEST_PERSONAL_PHOTO_PATH,
} from './media.seed';
import { SeededBeneficiaries, SeededBeneficiaryAccount } from './seed.types';

export const BENEFICIARY_TEST_PASSWORD = '12345678';

const beneficiarySeedData = Array.from({ length: 15 }, (_, index) => {
  const accountNumber = index + 1;
  const statuses = [
    ...Array(7).fill(Status.PENDING),
    ...Array(5).fill(Status.ACCEPTED),
    ...Array(3).fill(Status.REJECTED),
  ] as Status[];
  const socialStatuses = [
    SocialStatus.SINGLE,
    SocialStatus.MARRIED,
    SocialStatus.WIDOWED,
    SocialStatus.DIVORCED,
  ];
  const socialStatus = socialStatuses[index % socialStatuses.length];
  const isUnemployed = accountNumber % 3 === 0;
  const status = statuses[index];

  return {
    firstName: `Beneficiary${accountNumber}`,
    lastName: 'Test',
    email: `beneficiary${accountNumber}@test.com`,
    number: `9900000${accountNumber.toString().padStart(2, '0')}`,
    countryName: 'Syria',
    countryCode: '+963',
    gender: accountNumber % 2 === 0 ? Gender.FEMALE : Gender.MALE,
    socialStatus,
    numberOfChildren:
      socialStatus === SocialStatus.SINGLE ? null : (index % 5) + 1,
    isUnemployed,
    monthlyIncome: isUnemployed ? 0 : [250, 400, 650, 800][index % 4],
    status,
    address: {
      ar: `دمشق - منطقة اختبار ${accountNumber}`,
      en: `Damascus - Test Area ${accountNumber}`,
    },
    rejectionReason:
      status === Status.REJECTED
        ? {
            ar: 'بيانات التسجيل غير مكتملة.',
            en: 'Registration information is incomplete.',
          }
        : null,
  };
});

export async function seedBeneficiaries(
  prisma: PrismaClient,
): Promise<SeededBeneficiaries> {
  const hashedPassword = await bcrypt.hash(BENEFICIARY_TEST_PASSWORD, 10);
  const accounts: SeededBeneficiaryAccount[] = [];

  for (const beneficiaryData of beneficiarySeedData) {
    const user = await prisma.user.upsert({
      where: { email: beneficiaryData.email },
      update: {
        firstName: beneficiaryData.firstName,
        lastName: beneficiaryData.lastName,
        password: hashedPassword,
        number: beneficiaryData.number,
        countryName: beneficiaryData.countryName,
        countryCode: beneficiaryData.countryCode,
        gender: beneficiaryData.gender,
        userType: UserType.BENEFICIARY,
      },
      create: {
        firstName: beneficiaryData.firstName,
        lastName: beneficiaryData.lastName,
        email: beneficiaryData.email,
        password: hashedPassword,
        number: beneficiaryData.number,
        countryName: beneficiaryData.countryName,
        countryCode: beneficiaryData.countryCode,
        gender: beneficiaryData.gender,
        userType: UserType.BENEFICIARY,
      },
    });

    await prisma.beneficiary.upsert({
      where: { userId: user.id },
      update: beneficiaryDetails(beneficiaryData),
      create: {
        userId: user.id,
        ...beneficiaryDetails(beneficiaryData),
      },
    });

    accounts.push({
      email: beneficiaryData.email,
      password: BENEFICIARY_TEST_PASSWORD,
      status: beneficiaryData.status,
    });
  }

  const acceptedBeneficiaries = await prisma.beneficiary.findMany({
    where: { status: Status.ACCEPTED },
    select: {
      id: true,
      address: true,
      socialStatus: true,
      isUnemployed: true,
      user: {
        select: { firstName: true, lastName: true, gender: true },
      },
    },
    orderBy: { id: 'asc' },
  });

  if (acceptedBeneficiaries.length === 0) {
    throw new Error(
      'Cannot seed assistance requests without an accepted beneficiary.',
    );
  }

  return { accounts, acceptedBeneficiaries };
}

function beneficiaryDetails(
  beneficiaryData: (typeof beneficiarySeedData)[number],
) {
  return {
    personalPhoto: TEST_PERSONAL_PHOTO_PATH,
    familyStatement: TEST_FAMILY_STATEMENT_PATH,
    address: beneficiaryData.address,
    status: beneficiaryData.status,
    rejectionReason: beneficiaryData.rejectionReason ?? Prisma.JsonNull,
    socialStatus: beneficiaryData.socialStatus,
    numberOfChildren: beneficiaryData.numberOfChildren,
    isUnemployed: beneficiaryData.isUnemployed,
    monthlyIncome: beneficiaryData.monthlyIncome,
  };
}
