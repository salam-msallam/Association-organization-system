import {
  Gender,
  Prisma,
  PrismaClient,
  SocialStatus,
  Status,
  TransactionStatus,
  TransactionType,
  TypeAid,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  TEST_FAMILY_STATEMENT_PATH,
  TEST_PERSONAL_PHOTO_PATH,
  TEST_REQUEST_MEDIA_PATH,
} from './media.seed';
import { AcceptedBeneficiary, SeededCategories } from './seed.types';

export const DONOR_FINANCIAL_HISTORY_TEST_PASSWORD = '12345678';

const REQUEST_AID_REFERENCE_TYPE = 'REQUEST_AID';
const WALLET_REFERENCE_TYPE = 'WALLET';
const SPONSORSHIP_REFERENCE_TYPE = 'SPONSORSHIP';

const seedDonors = [
  {
    firstName: 'DonorHistory1',
    lastName: 'Test',
    email: 'donor-history-1@test.com',
    number: '981100001',
    gender: Gender.MALE,
    zipCode: '10001',
  },
  {
    firstName: 'DonorHistory2',
    lastName: 'Test',
    email: 'donor-history-2@test.com',
    number: '981100002',
    gender: Gender.FEMALE,
    zipCode: '10002',
  },
  {
    firstName: 'DonorHistory3',
    lastName: 'Test',
    email: 'donor-history-3@test.com',
    number: '981100003',
    gender: Gender.MALE,
    zipCode: '10003',
  },
] as const;

const seedAidRequestNumbers = Array.from(
  { length: seedDonors.length * 3 },
  (_, index) => `992000${(index + 1).toString().padStart(3, '0')}`,
);

type SeedDonorAccount = {
  donorId: number;
  userId: number;
  email: string;
  password: string;
};

type SeedDonorWithWallet = SeedDonorAccount & {
  walletId: number;
};

type IdOnly = { id: number };

type SeedAidRequestData = {
  beneficiaryId: number;
  categoryId: number;
  subCategoryId: null;
  firstName: string;
  lastName: string;
  beneficiaryFatherName: string;
  socialStatus: SocialStatus;
  address: Prisma.InputJsonValue;
  age: number;
  isUnemployed: boolean;
  gender: Gender;
  title: Prisma.InputJsonValue;
  details: Prisma.InputJsonValue;
  description: Prisma.InputJsonValue;
  cost: Prisma.Decimal;
  status: Status;
  rejectionReason: typeof Prisma.JsonNull;
  isUrgent: boolean;
  reviewedAt: Date;
};

type SeedOrphanData = {
  fatherName: string;
  motherName: string;
  birthOfDate: Date;
  gender: Gender;
  class: Prisma.InputJsonValue;
  Diseases: Prisma.InputJsonValue;
  FamilyStatement: string;
  brotherAndSisterNumber: number;
  guaranteedPhone: string;
  bodySize: number;
  shoesSize: number;
  currentAddress: Prisma.InputJsonValue;
  previousAddress: Prisma.InputJsonValue;
  talent: Prisma.InputJsonValue;
  isSupported: boolean;
};

export async function seedDonorFinancialHistory(
  prisma: PrismaClient,
  categories: SeededCategories,
  acceptedBeneficiaries: AcceptedBeneficiary[],
): Promise<SeedDonorAccount[]> {
  const hashedPassword = await bcrypt.hash(
    DONOR_FINANCIAL_HISTORY_TEST_PASSWORD,
    10,
  );

  return prisma.$transaction(async (transaction) => {
    await rollbackPreviousSeedHistory(transaction);

    const [aidRequests, employee, orphans] = await Promise.all([
      ensureAidRequests(transaction, categories, acceptedBeneficiaries),
      ensureEmployee(transaction, hashedPassword),
      ensureOrphans(transaction),
    ]);

    const donorAccounts: SeedDonorWithWallet[] = [];

    for (const donorData of seedDonors) {
      const donorAccount = await ensureDonorAccount(
        transaction,
        donorData,
        hashedPassword,
      );

      donorAccounts.push(donorAccount);
    }

    for (const [index, donorAccount] of donorAccounts.entries()) {
      await createDonorHistoryScenario(transaction, {
        donor: donorAccount,
        requestAids: aidRequests.slice(index * 3, index * 3 + 3),
        orphanId: orphans[index].id,
        employeeId: employee.id,
        donorIndex: index,
      });
    }

    return donorAccounts.map(({ walletId, ...account }) => account);
  });
}

async function rollbackPreviousSeedHistory(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  const existingSeedDonors = await transaction.donor.findMany({
    where: {
      user: {
        email: { in: seedDonors.map((donor) => donor.email) },
      },
    },
    select: {
      id: true,
      userId: true,
      wallet: { select: { id: true } },
    },
  });

  const donorUserIds = existingSeedDonors.map((donor) => donor.userId);
  const donorIds = existingSeedDonors.map((donor) => donor.id);
  const walletIds = existingSeedDonors
    .map((donor) => donor.wallet?.id)
    .filter((id): id is number => id !== undefined);

  await rollbackAidRequestPayments(transaction, donorUserIds, walletIds);

  if (walletIds.length > 0) {
    await transaction.walletTransaction.deleteMany({
      where: { walletId: { in: walletIds } },
    });
  }

  if (donorUserIds.length > 0) {
    await transaction.transaction.deleteMany({
      where: { donorId: { in: donorUserIds } },
    });
    await transaction.sponsorship.deleteMany({
      where: { donorId: { in: donorIds } },
    });
    await transaction.wallet.updateMany({
      where: { donorId: { in: donorUserIds } },
      data: { runningBalance: new Prisma.Decimal(0) },
    });
    await transaction.donor.updateMany({
      where: { userId: { in: donorUserIds } },
      data: { isSponsor: false },
    });
  }
}

async function rollbackAidRequestPayments(
  transaction: Prisma.TransactionClient,
  donorUserIds: number[],
  walletIds: number[],
): Promise<void> {
  const [directDonations, walletDonations] = await Promise.all([
    donorUserIds.length > 0
      ? transaction.transaction.findMany({
          where: {
            donorId: { in: donorUserIds },
            status: TransactionStatus.SUCCESSFUL,
            type: TransactionType.AID_REQUEST_DONATION,
            referenceType: REQUEST_AID_REFERENCE_TYPE,
            referenceId: { not: null },
          },
          select: { amount: true, referenceId: true },
        })
      : [],
    walletIds.length > 0
      ? transaction.walletTransaction.findMany({
          where: {
            walletId: { in: walletIds },
            direction: WalletTransactionDirection.DEBIT,
            type: TransactionType.AID_REQUEST_DONATION,
            referenceType: REQUEST_AID_REFERENCE_TYPE,
            referenceId: { not: null },
          },
          select: { amount: true, referenceId: true },
        })
      : [],
  ]);

  const totals = new Map<number, Prisma.Decimal>();

  for (const donation of [...directDonations, ...walletDonations]) {
    if (!donation.referenceId) continue;

    const existingTotal =
      totals.get(donation.referenceId) ?? new Prisma.Decimal(0);
    totals.set(
      donation.referenceId,
      existingTotal.plus(new Prisma.Decimal(donation.amount)),
    );
  }

  for (const [requestAidId, amount] of totals) {
    const requestAid = await transaction.requestAid.findUnique({
      where: { id: requestAidId },
      select: { currentPayment: true },
    });

    if (!requestAid) continue;

    const nextPayment = new Prisma.Decimal(requestAid.currentPayment).minus(
      amount,
    );

    await transaction.requestAid.update({
      where: { id: requestAidId },
      data: {
        currentPayment: nextPayment.isNegative()
          ? new Prisma.Decimal(0)
          : nextPayment,
      },
    });
  }
}

async function ensureAidRequests(
  transaction: Prisma.TransactionClient,
  categories: SeededCategories,
  acceptedBeneficiaries: AcceptedBeneficiary[],
): Promise<IdOnly[]> {
  if (acceptedBeneficiaries.length === 0) {
    throw new Error(
      'Cannot seed donor history without accepted beneficiaries.',
    );
  }

  const reusableRequests = await transaction.requestAid.findMany({
    where: {
      status: Status.ACCEPTED,
      number: { notIn: seedAidRequestNumbers },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: seedAidRequestNumbers.length,
  });

  if (reusableRequests.length >= seedAidRequestNumbers.length) {
    return reusableRequests;
  }

  const requiredSeedRequestCount =
    seedAidRequestNumbers.length - reusableRequests.length;
  const seedRequests: IdOnly[] = [];

  for (let index = 0; index < requiredSeedRequestCount; index += 1) {
    const requestNumber = seedAidRequestNumbers[index];
    const beneficiary =
      acceptedBeneficiaries[index % acceptedBeneficiaries.length];
    const existingSeedRequest = await transaction.requestAid.findFirst({
      where: { number: requestNumber },
      select: { id: true },
    });

    if (existingSeedRequest) {
      await transaction.requestAid.update({
        where: { id: existingSeedRequest.id },
        data: buildSeedAidRequestUpdateData(categories, beneficiary, index),
      });
      seedRequests.push(existingSeedRequest);
      continue;
    }

    const createdRequest = await transaction.requestAid.create({
      data: {
        ...buildSeedAidRequestCreateData(categories, beneficiary, index),
        number: requestNumber,
      },
      select: { id: true },
    });

    seedRequests.push(createdRequest);
  }

  return [...reusableRequests, ...seedRequests];
}

function buildSeedAidRequestCreateData(
  categories: SeededCategories,
  beneficiary: AcceptedBeneficiary,
  index: number,
): Prisma.RequestAidUncheckedCreateInput {
  return {
    ...buildSeedAidRequestData(categories, beneficiary, index),
    beneficiaryId: beneficiary.id,
    categoryId: categories.healthCategoryId,
    subCategoryId: null,
    number: seedAidRequestNumbers[index],
    currentPayment: new Prisma.Decimal(0),
    aidDetails: {
      create: {
        typeAid: TypeAid.SURGERY,
        mediaUrls: [TEST_REQUEST_MEDIA_PATH],
      },
    },
  };
}

function buildSeedAidRequestUpdateData(
  categories: SeededCategories,
  beneficiary: AcceptedBeneficiary,
  index: number,
): Prisma.RequestAidUncheckedUpdateInput {
  return buildSeedAidRequestData(categories, beneficiary, index);
}

function buildSeedAidRequestData(
  categories: SeededCategories,
  beneficiary: AcceptedBeneficiary,
  index: number,
): SeedAidRequestData {
  return {
    beneficiaryId: beneficiary.id,
    categoryId: categories.healthCategoryId,
    subCategoryId: null,
    firstName: beneficiary.user.firstName,
    lastName: beneficiary.user.lastName,
    beneficiaryFatherName: `Donor History Father ${index + 1}`,
    socialStatus: beneficiary.socialStatus,
    address: beneficiary.address as Prisma.InputJsonValue,
    age: 30 + index,
    isUnemployed: beneficiary.isUnemployed,
    gender: beneficiary.user.gender,
    title: {
      ar: `طلب سجل المتبرع ${index + 1}`,
      en: `Donor history request ${index + 1}`,
    },
    details: {
      ar: `تفاصيل طلب تجريبي لسجل المتبرع ${index + 1}`,
      en: `Seeded donor history request details ${index + 1}`,
    },
    description: {
      ar: 'طلب مقبول لاختبار سجل التبرعات.',
      en: 'Accepted request for testing donor financial history.',
    },
    cost: new Prisma.Decimal(10000),
    status: Status.ACCEPTED,
    rejectionReason: Prisma.JsonNull,
    isUrgent: index % 2 === 0,
    reviewedAt: new Date(new Date().getFullYear(), 0, 2, 9),
  };
}

async function ensureEmployee(
  transaction: Prisma.TransactionClient,
  hashedPassword: string,
) {
  const existingEmployee = await transaction.employee.findFirst({
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (existingEmployee) return existingEmployee;

  const user = await transaction.user.upsert({
    where: { email: 'donor-history-employee@test.com' },
    update: {
      firstName: 'DonorHistory',
      lastName: 'Employee',
      password: hashedPassword,
      number: '981199999',
      countryName: 'Syria',
      countryCode: '+963',
      gender: Gender.MALE,
      userType: UserType.EMPLOYEE,
    },
    create: {
      firstName: 'DonorHistory',
      lastName: 'Employee',
      email: 'donor-history-employee@test.com',
      password: hashedPassword,
      number: '981199999',
      countryName: 'Syria',
      countryCode: '+963',
      gender: Gender.MALE,
      userType: UserType.EMPLOYEE,
    },
    select: { id: true },
  });

  return transaction.employee.upsert({
    where: { userId: user.id },
    update: {
      personalPhoto: TEST_PERSONAL_PHOTO_PATH,
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
    },
    create: {
      userId: user.id,
      personalPhoto: TEST_PERSONAL_PHOTO_PATH,
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
    },
    select: { id: true },
  });
}

async function ensureOrphans(
  transaction: Prisma.TransactionClient,
): Promise<IdOnly[]> {
  const orphans: IdOnly[] = [];

  for (let index = 0; index < seedDonors.length; index += 1) {
    const firstName = `SeedOrphanHistory${index + 1}`;
    const lastName = 'Test';
    const guardianName = `Seed Guardian History ${index + 1}`;
    const existingOrphan = await transaction.orphan.findFirst({
      where: { firstName, lastName, guardianName },
      select: { id: true },
    });

    if (existingOrphan) {
      await transaction.orphan.update({
        where: { id: existingOrphan.id },
        data: buildSeedOrphanData(index),
      });
      orphans.push(existingOrphan);
      continue;
    }

    const orphan = await transaction.orphan.create({
      data: {
        firstName,
        lastName,
        guardianName,
        ...buildSeedOrphanData(index),
      },
      select: { id: true },
    });

    orphans.push(orphan);
  }

  return orphans;
}

function buildSeedOrphanData(index: number): SeedOrphanData {
  return {
    fatherName: `Seed Father ${index + 1}`,
    motherName: `Seed Mother ${index + 1}`,
    birthOfDate: new Date(2014 - index, 4, 12),
    gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
    class: { ar: 'الصف السادس', en: 'Grade six' },
    Diseases: { ar: 'لا يوجد', en: 'None' },
    FamilyStatement: TEST_FAMILY_STATEMENT_PATH,
    brotherAndSisterNumber: 2 + index,
    guaranteedPhone: `+96398118888${index}`,
    bodySize: 10 + index,
    shoesSize: 32 + index,
    currentAddress: { ar: 'دمشق', en: 'Damascus' },
    previousAddress: { ar: 'ريف دمشق', en: 'Rural Damascus' },
    talent: { ar: 'الرسم', en: 'Drawing' },
    isSupported: true,
  };
}

async function ensureDonorAccount(
  transaction: Prisma.TransactionClient,
  donorData: (typeof seedDonors)[number],
  hashedPassword: string,
): Promise<SeedDonorWithWallet> {
  const user = await transaction.user.upsert({
    where: { email: donorData.email },
    update: {
      firstName: donorData.firstName,
      lastName: donorData.lastName,
      password: hashedPassword,
      number: donorData.number,
      countryName: 'Syria',
      countryCode: '+963',
      gender: donorData.gender,
      userType: UserType.DONOR,
    },
    create: {
      firstName: donorData.firstName,
      lastName: donorData.lastName,
      email: donorData.email,
      password: hashedPassword,
      number: donorData.number,
      countryName: 'Syria',
      countryCode: '+963',
      gender: donorData.gender,
      userType: UserType.DONOR,
    },
    select: { id: true, email: true },
  });

  const donor = await transaction.donor.upsert({
    where: { userId: user.id },
    update: {
      zipCode: donorData.zipCode,
      isSponsor: true,
    },
    create: {
      userId: user.id,
      zipCode: donorData.zipCode,
      isSponsor: true,
    },
    select: { id: true, userId: true },
  });

  const wallet = await transaction.wallet.upsert({
    where: { donorId: donor.userId },
    update: { runningBalance: new Prisma.Decimal(0) },
    create: {
      donorId: donor.userId,
      runningBalance: new Prisma.Decimal(0),
    },
    select: { id: true },
  });

  return {
    donorId: donor.id,
    userId: donor.userId,
    walletId: wallet.id,
    email: user.email,
    password: DONOR_FINANCIAL_HISTORY_TEST_PASSWORD,
  };
}

async function createDonorHistoryScenario(
  transaction: Prisma.TransactionClient,
  input: {
    donor: SeedDonorWithWallet;
    requestAids: Array<{ id: number }>;
    orphanId: number;
    employeeId: number;
    donorIndex: number;
  },
): Promise<void> {
  const amounts = {
    directFirst: new Prisma.Decimal(40 + input.donorIndex * 10),
    directSecond: new Prisma.Decimal(45 + input.donorIndex * 10),
    topUp: new Prisma.Decimal(200 + input.donorIndex * 20),
    walletAid: new Prisma.Decimal(25 + input.donorIndex * 5),
    sponsorship: new Prisma.Decimal(10),
  };
  const baseMonth = input.donorIndex * 2;
  const directFirstDate = seedDate(baseMonth, 3, 9);
  const directSecondDate = seedDate(baseMonth, 9, 10);
  const topUpDate = seedDate(baseMonth, 15, 11);
  const walletAidDate = seedDate(baseMonth, 21, 12);
  const sponsorshipDate = seedDate(baseMonth, 27, 13);

  await createSuccessfulAidRequestTransaction(transaction, {
    donorUserId: input.donor.userId,
    requestAidId: input.requestAids[0].id,
    amount: amounts.directFirst,
    createdAt: directFirstDate,
  });

  await createSuccessfulAidRequestTransaction(transaction, {
    donorUserId: input.donor.userId,
    requestAidId: input.requestAids[1].id,
    amount: amounts.directSecond,
    createdAt: directSecondDate,
  });

  const topUpTransaction = await transaction.transaction.create({
    data: {
      donorId: input.donor.userId,
      amount: amounts.topUp,
      status: TransactionStatus.SUCCESSFUL,
      type: TransactionType.WALLET_TOP_UP,
      referenceType: WALLET_REFERENCE_TYPE,
      referenceId: input.donor.walletId,
      currency: 'usd',
      createdAt: topUpDate,
    },
    select: { id: true },
  });

  let runningBalance = amounts.topUp;

  await transaction.walletTransaction.create({
    data: {
      walletId: input.donor.walletId,
      transactionId: topUpTransaction.id,
      amount: amounts.topUp,
      type: TransactionType.WALLET_TOP_UP,
      direction: WalletTransactionDirection.CREDIT,
      referenceType: WALLET_REFERENCE_TYPE,
      referenceId: input.donor.walletId,
      balanceAfter: runningBalance,
      createdAt: topUpDate,
    },
  });

  runningBalance = runningBalance.minus(amounts.walletAid);

  await transaction.walletTransaction.create({
    data: {
      walletId: input.donor.walletId,
      transactionId: null,
      amount: amounts.walletAid,
      type: TransactionType.AID_REQUEST_DONATION,
      direction: WalletTransactionDirection.DEBIT,
      referenceType: REQUEST_AID_REFERENCE_TYPE,
      referenceId: input.requestAids[2].id,
      balanceAfter: runningBalance,
      createdAt: walletAidDate,
    },
  });

  await incrementAidRequestPayment(
    transaction,
    input.requestAids[2].id,
    amounts.walletAid,
  );

  const sponsorship = await transaction.sponsorship.create({
    data: {
      donorId: input.donor.donorId,
      orphanId: input.orphanId,
      employeeId: input.employeeId,
      amount: amounts.sponsorship,
      status: Status.ACCEPTED,
      startDate: seedDate(0, 1, 0),
      //endDate: seedDate(11, 31, 0),
      createdAt: sponsorshipDate,
    },
    select: { id: true },
  });

  runningBalance = runningBalance.minus(amounts.sponsorship);

  await transaction.walletTransaction.create({
    data: {
      walletId: input.donor.walletId,
      transactionId: null,
      amount: amounts.sponsorship,
      type: TransactionType.SPONSORSHIP_DONATION,
      direction: WalletTransactionDirection.DEBIT,
      referenceType: SPONSORSHIP_REFERENCE_TYPE,
      referenceId: sponsorship.id,
      balanceAfter: runningBalance,
      createdAt: sponsorshipDate,
    },
  });

  await transaction.wallet.update({
    where: { id: input.donor.walletId },
    data: { runningBalance },
  });

  await transaction.donor.update({
    where: { userId: input.donor.userId },
    data: { isSponsor: true },
  });

  await transaction.orphan.update({
    where: { id: input.orphanId },
    data: { isSupported: true },
  });
}

async function createSuccessfulAidRequestTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    donorUserId: number;
    requestAidId: number;
    amount: Prisma.Decimal;
    createdAt: Date;
  },
): Promise<void> {
  await transaction.transaction.create({
    data: {
      donorId: input.donorUserId,
      amount: input.amount,
      status: TransactionStatus.SUCCESSFUL,
      type: TransactionType.AID_REQUEST_DONATION,
      referenceType: REQUEST_AID_REFERENCE_TYPE,
      referenceId: input.requestAidId,
      currency: 'usd',
      createdAt: input.createdAt,
    },
  });

  await incrementAidRequestPayment(
    transaction,
    input.requestAidId,
    input.amount,
  );
}

async function incrementAidRequestPayment(
  transaction: Prisma.TransactionClient,
  requestAidId: number,
  amount: Prisma.Decimal,
): Promise<void> {
  await transaction.requestAid.update({
    where: { id: requestAidId },
    data: { currentPayment: { increment: amount } },
  });
}

function seedDate(monthIndex: number, day: number, hour: number): Date {
  return new Date(new Date().getFullYear(), monthIndex, day, hour);
}
