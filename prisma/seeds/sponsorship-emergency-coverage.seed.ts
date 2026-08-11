import {
  CancellationSource,
  Gender,
  OrphanEmergencyCoverageReason,
  OrphanEmergencyCoverageStatus,
  Prisma,
  PrismaClient,
  Status,
  TransactionStatus,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  TEST_FAMILY_STATEMENT_PATH,
  TEST_PERSONAL_PHOTO_PATH,
} from './media.seed';

const SPONSORSHIP_FUND_SEED_REFERENCE_TYPE = 'SPONSORSHIP_FUND_SEED';
const TEST_PASSWORD = '12345678';

const donorEmails = [
  'donor-history-1@test.com',
  'donor-history-2@test.com',
  'donor-history-3@test.com',
] as const;

const coverageOfficers = [
  {
    firstName: 'Maya',
    lastName: 'Haddad',
    email: 'coverage-officer-1@test.com',
    number: '982200001',
    gender: Gender.FEMALE,
    dateOfBirth: new Date('1988-03-12T00:00:00.000Z'),
  },
  {
    firstName: 'Omar',
    lastName: 'Nassar',
    email: 'coverage-officer-2@test.com',
    number: '982200002',
    gender: Gender.MALE,
    dateOfBirth: new Date('1985-09-04T00:00:00.000Z'),
  },
  {
    firstName: 'Rana',
    lastName: 'Khalil',
    email: 'coverage-officer-3@test.com',
    number: '982200003',
    gender: Gender.FEMALE,
    dateOfBirth: new Date('1991-01-18T00:00:00.000Z'),
  },
] as const;

const emergencyOrphans = [
  {
    firstName: 'EmergencyOrphan1',
    lastName: 'Coverage',
    guardianName: 'Emergency Guardian Coverage 1',
    fatherName: 'Adnan',
    motherName: 'Salma',
    birthOfDate: new Date('2015-02-10T00:00:00.000Z'),
    gender: Gender.MALE,
    brotherAndSisterNumber: 2,
    guaranteedPhone: '+963982210001',
    bodySize: 10,
    shoesSize: 33,
    talent: { ar: 'الرسم', en: 'Drawing' },
  },
  {
    firstName: 'EmergencyOrphan2',
    lastName: 'Coverage',
    guardianName: 'Emergency Guardian Coverage 2',
    fatherName: 'Firas',
    motherName: 'Hala',
    birthOfDate: new Date('2013-07-22T00:00:00.000Z'),
    gender: Gender.FEMALE,
    brotherAndSisterNumber: 3,
    guaranteedPhone: '+963982210002',
    bodySize: 12,
    shoesSize: 35,
    talent: { ar: 'القراءة', en: 'Reading' },
  },
  {
    firstName: 'EmergencyOrphan3',
    lastName: 'Coverage',
    guardianName: 'Emergency Guardian Coverage 3',
    fatherName: 'Mahmoud',
    motherName: 'Lina',
    birthOfDate: new Date('2016-11-05T00:00:00.000Z'),
    gender: Gender.MALE,
    brotherAndSisterNumber: 1,
    guaranteedPhone: '+963982210003',
    bodySize: 9,
    shoesSize: 31,
    talent: { ar: 'كرة القدم', en: 'Football' },
  },
] as const;

const scenarios = [
  {
    cancellationSource: CancellationSource.DONOR,
    reason: OrphanEmergencyCoverageReason.SPONSOR_CANCELLED,
    supportedMonths: 1,
    status: OrphanEmergencyCoverageStatus.ACTIVE,
    supportCount: 1,
    amount: new Prisma.Decimal(10),
  },
  {
    cancellationSource: CancellationSource.AUTOMATIC,
    reason: OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
    supportedMonths: 2,
    status: OrphanEmergencyCoverageStatus.COMPLETED,
    supportCount: 2,
    amount: new Prisma.Decimal(10),
  },
  {
    cancellationSource: CancellationSource.AUTOMATIC,
    reason: OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
    supportedMonths: 1,
    status: OrphanEmergencyCoverageStatus.ACTIVE,
    supportCount: 1,
    amount: new Prisma.Decimal(10),
  },
] as const;

type IdOnly = { id: number };

type EmergencyOrphanData = {
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

type SeedDonorWithWallet = {
  id: number;
  userId: number;
  user: { email: string };
  wallet: {
    id: number;
    runningBalance: Prisma.Decimal;
  };
};

type SeededCoverageAccount = {
  sponsorshipId: number;
  coverageId: number;
  orphanId: number;
  donorEmail: string;
  reason: OrphanEmergencyCoverageReason;
  status: OrphanEmergencyCoverageStatus;
};

export async function seedSponsorshipEmergencyCoverage(
  prisma: PrismaClient,
): Promise<SeededCoverageAccount[]> {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

  return prisma.$transaction(async (transaction) => {
    await rollbackPreviousEmergencyCoverageSeed(transaction);

    const donors = await getSeedDonors(transaction);
    const [employees, orphans] = await Promise.all([
      ensureCoverageEmployees(transaction, hashedPassword),
      ensureEmergencyOrphans(transaction),
    ]);

    await createFundDonationSeed(transaction, donors);

    const seededCoverages: SeededCoverageAccount[] = [];
    let fundBalanceAfterSeedDonations = new Prisma.Decimal(250);

    for (let index = 0; index < scenarios.length; index += 1) {
      const scenario = scenarios[index];
      const monthlySupport = scenario.amount.times('0.5');
      const startDate = seedDate(2 + index, 1, 9);
      const endDate =
        scenario.status === OrphanEmergencyCoverageStatus.COMPLETED
          ? seedDate(4 + index, 20, 9)
          : null;

      const sponsorship = await transaction.sponsorship.create({
        data: {
          donorId: donors[index].id,
          orphanId: orphans[index].id,
          employeeId: employees[index].id,
          amount: scenario.amount,
          status: Status.CANCELLED,
          startDate,
          endDate: seedDate(3 + index, 1, 9),
          cancellationSource: scenario.cancellationSource,
          createdAt: seedDate(1 + index, 15, 10),
        },
        select: { id: true },
      });

      const coverage = await transaction.orphanEmergencyCoverage.create({
        data: {
          orphanId: orphans[index].id,
          sponsorshipId: sponsorship.id,
          originalAmount: scenario.amount,
          monthlySupport,
          supportedMonths: scenario.supportedMonths,
          startDate: seedDate(3 + index, 1, 9),
          endDate,
          status: scenario.status,
          reason: scenario.reason,
        },
        select: { id: true },
      });

      for (let supportIndex = 0; supportIndex < scenario.supportCount; supportIndex += 1) {
        fundBalanceAfterSeedDonations =
          fundBalanceAfterSeedDonations.minus(monthlySupport);

        await transaction.sponsorshipFundSupport.create({
          data: {
            coverageId: coverage.id,
            amount: monthlySupport,
            balanceAfter: fundBalanceAfterSeedDonations,
            createdAt: seedDate(3 + index + supportIndex, 20, 9),
          },
        });
      }

      seededCoverages.push({
        sponsorshipId: sponsorship.id,
        coverageId: coverage.id,
        orphanId: orphans[index].id,
        donorEmail: donorEmails[index],
        reason: scenario.reason,
        status: scenario.status,
      });
    }

    return seededCoverages;
  });
}

async function rollbackPreviousEmergencyCoverageSeed(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  const seedSponsorships = await transaction.sponsorship.findMany({
    where: {
      orphan: {
        firstName: { in: emergencyOrphans.map((orphan) => orphan.firstName) },
        lastName: 'Coverage',
      },
    },
    select: { id: true },
  });
  const sponsorshipIds = seedSponsorships.map((sponsorship) => sponsorship.id);

  if (sponsorshipIds.length > 0) {
    const coverages = await transaction.orphanEmergencyCoverage.findMany({
      where: { sponsorshipId: { in: sponsorshipIds } },
      select: { id: true },
    });
    const coverageIds = coverages.map((coverage) => coverage.id);

    if (coverageIds.length > 0) {
      await transaction.sponsorshipFundSupport.deleteMany({
        where: { coverageId: { in: coverageIds } },
      });
      await transaction.orphanEmergencyCoverage.deleteMany({
        where: { id: { in: coverageIds } },
      });
    }

    await transaction.sponsorship.deleteMany({
      where: { id: { in: sponsorshipIds } },
    });
  }

  await transaction.walletTransaction.deleteMany({
    where: {
      type: TransactionType.GENERAL_DONATION,
      referenceType: SPONSORSHIP_FUND_SEED_REFERENCE_TYPE,
    },
  });
  await transaction.transaction.deleteMany({
    where: {
      type: TransactionType.GENERAL_DONATION,
      referenceType: SPONSORSHIP_FUND_SEED_REFERENCE_TYPE,
    },
  });

  await transaction.orphan.updateMany({
    where: {
      firstName: { in: emergencyOrphans.map((orphan) => orphan.firstName) },
      lastName: 'Coverage',
    },
    data: { isSupported: false },
  });
}

async function getSeedDonors(
  transaction: Prisma.TransactionClient,
): Promise<SeedDonorWithWallet[]> {
  const donors = await transaction.donor.findMany({
    where: {
      user: {
        email: { in: [...donorEmails] },
      },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true } },
      wallet: { select: { id: true, runningBalance: true } },
    },
  });
  const donorByEmail = new Map(
    donors.map((donor) => [donor.user.email, donor]),
  );

  return donorEmails.map((email): SeedDonorWithWallet => {
    const donor = donorByEmail.get(email);

    if (!donor?.wallet) {
      throw new Error(
        `Sponsorship emergency coverage seed requires donor wallet for ${email}.`,
      );
    }

    return {
      id: donor.id,
      userId: donor.userId,
      user: donor.user,
      wallet: donor.wallet,
    };
  });
}

async function ensureCoverageEmployees(
  transaction: Prisma.TransactionClient,
  hashedPassword: string,
): Promise<IdOnly[]> {
  const employees: IdOnly[] = [];

  for (const officer of coverageOfficers) {
    const user = await transaction.user.upsert({
      where: { email: officer.email },
      update: {
        firstName: officer.firstName,
        lastName: officer.lastName,
        password: hashedPassword,
        number: officer.number,
        countryName: 'Syria',
        countryCode: '+963',
        gender: officer.gender,
        userType: UserType.EMPLOYEE,
      },
      create: {
        firstName: officer.firstName,
        lastName: officer.lastName,
        email: officer.email,
        password: hashedPassword,
        number: officer.number,
        countryName: 'Syria',
        countryCode: '+963',
        gender: officer.gender,
        userType: UserType.EMPLOYEE,
      },
      select: { id: true },
    });

    const employee = await transaction.employee.upsert({
      where: { userId: user.id },
      update: {
        personalPhoto: TEST_PERSONAL_PHOTO_PATH,
        dateOfBirth: officer.dateOfBirth,
      },
      create: {
        userId: user.id,
        personalPhoto: TEST_PERSONAL_PHOTO_PATH,
        dateOfBirth: officer.dateOfBirth,
      },
      select: { id: true },
    });

    employees.push(employee);
  }

  return employees;
}

async function ensureEmergencyOrphans(
  transaction: Prisma.TransactionClient,
): Promise<IdOnly[]> {
  const orphans: IdOnly[] = [];

  for (const orphanData of emergencyOrphans) {
    const existingOrphan = await transaction.orphan.findFirst({
      where: {
        firstName: orphanData.firstName,
        lastName: orphanData.lastName,
        guardianName: orphanData.guardianName,
      },
      select: { id: true },
    });

    const data = buildEmergencyOrphanData(orphanData);

    if (existingOrphan) {
      const orphan = await transaction.orphan.update({
        where: { id: existingOrphan.id },
        data,
        select: { id: true },
      });

      orphans.push(orphan);
      continue;
    }

    const orphan = await transaction.orphan.create({
      data: {
        firstName: orphanData.firstName,
        lastName: orphanData.lastName,
        guardianName: orphanData.guardianName,
        ...data,
      },
      select: { id: true },
    });

    orphans.push(orphan);
  }

  return orphans;
}

function buildEmergencyOrphanData(
  orphanData: (typeof emergencyOrphans)[number],
): EmergencyOrphanData {
  return {
    fatherName: orphanData.fatherName,
    motherName: orphanData.motherName,
    birthOfDate: orphanData.birthOfDate,
    gender: orphanData.gender,
    class: { ar: 'المرحلة الابتدائية', en: 'Primary school' },
    Diseases: { ar: 'لا يوجد', en: 'None' },
    FamilyStatement: TEST_FAMILY_STATEMENT_PATH,
    brotherAndSisterNumber: orphanData.brotherAndSisterNumber,
    guaranteedPhone: orphanData.guaranteedPhone,
    bodySize: orphanData.bodySize,
    shoesSize: orphanData.shoesSize,
    currentAddress: { ar: 'دمشق', en: 'Damascus' },
    previousAddress: { ar: 'ريف دمشق', en: 'Rural Damascus' },
    talent: orphanData.talent,
    isSupported: false,
  };
}

async function createFundDonationSeed(
  transaction: Prisma.TransactionClient,
  donors: SeedDonorWithWallet[],
): Promise<void> {
  await transaction.transaction.createMany({
    data: [
      {
        donorId: donors[0].userId,
        stripePaymentIntentId: 'pi_sponsorship_fund_seed_1',
        idempotencyKey: 'payment-intent:sponsorship-fund-seed-1',
        amount: new Prisma.Decimal(120),
        status: TransactionStatus.SUCCESSFUL,
        type: TransactionType.GENERAL_DONATION,
        referenceType: SPONSORSHIP_FUND_SEED_REFERENCE_TYPE,
        referenceId: 1,
        currency: 'usd',
        createdAt: seedDate(0, 5, 9),
      },
      {
        donorId: donors[1].userId,
        stripePaymentIntentId: 'pi_sponsorship_fund_seed_2',
        idempotencyKey: 'payment-intent:sponsorship-fund-seed-2',
        amount: new Prisma.Decimal(90),
        status: TransactionStatus.SUCCESSFUL,
        type: TransactionType.GENERAL_DONATION,
        referenceType: SPONSORSHIP_FUND_SEED_REFERENCE_TYPE,
        referenceId: 2,
        currency: 'usd',
        createdAt: seedDate(0, 6, 10),
      },
    ],
  });

  const wallet = donors[2].wallet;
  const walletDonationAmount = new Prisma.Decimal(40);
  const balanceAfter = new Prisma.Decimal(wallet.runningBalance).minus(
    walletDonationAmount,
  );

  if (balanceAfter.isNegative()) {
    throw new Error(
      `Sponsorship emergency coverage seed requires at least $40 in ${donorEmails[2]}'s wallet.`,
    );
  }

  await transaction.walletTransaction.create({
    data: {
      walletId: wallet.id,
      transactionId: null,
      amount: walletDonationAmount,
      type: TransactionType.GENERAL_DONATION,
      direction: WalletTransactionDirection.DEBIT,
      referenceType: SPONSORSHIP_FUND_SEED_REFERENCE_TYPE,
      referenceId: 3,
      balanceAfter,
      createdAt: seedDate(0, 7, 11),
    },
  });

  await transaction.wallet.update({
    where: { id: wallet.id },
    data: { runningBalance: balanceAfter },
  });
}

function seedDate(monthIndex: number, day: number, hour: number): Date {
  return new Date(new Date().getFullYear(), monthIndex, day, hour);
}
