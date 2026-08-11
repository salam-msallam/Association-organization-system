import {
  OrphanEmergencyCoverageReason,
  OrphanEmergencyCoverageStatus,
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  WalletTransactionDirection,
} from '@prisma/client';
import { SponsorshipFundService } from './sponsorship-fund.service';

describe('SponsorshipFundService', () => {
  let prisma: any;
  let tx: any;
  let service: SponsorshipFundService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn(),
      transaction: {
        aggregate: jest.fn(),
      },
      walletTransaction: {
        aggregate: jest.fn(),
      },
      sponsorshipFundSupport: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      sponsorship: {
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      orphanEmergencyCoverage: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    prisma = {
      transaction: {
        aggregate: jest.fn(),
      },
      walletTransaction: {
        aggregate: jest.fn(),
      },
      sponsorshipFundSupport: {
        aggregate: jest.fn(),
      },
      orphanEmergencyCoverage: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    service = new SponsorshipFundService(prisma);
  });

  function mockFundBalance(
    stripeAmount = 100,
    walletAmount = 25,
    supportAmount = 20,
  ) {
    tx.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(stripeAmount) },
    });
    tx.walletTransaction.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(walletAmount) },
    });
    tx.sponsorshipFundSupport.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(supportAmount) },
    });
  }

  function mockActiveCoverage(overrides: Record<string, unknown> = {}) {
    tx.orphanEmergencyCoverage.findUnique.mockResolvedValue({
      id: 1,
      orphanId: 3,
      monthlySupport: new Prisma.Decimal(5),
      supportedMonths: 0,
      status: OrphanEmergencyCoverageStatus.ACTIVE,
      ...overrides,
    });
    tx.sponsorshipFundSupport.findFirst.mockResolvedValue(null);
    tx.sponsorship.findFirst.mockResolvedValue(null);
    mockFundBalance();
  }

  it('calculates sponsorship fund balance from successful Stripe and wallet donations minus supports', async () => {
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(100) },
    });
    prisma.walletTransaction.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(25) },
    });
    prisma.sponsorshipFundSupport.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(20) },
    });

    const result = await service.getSponsorshipFundBalance();

    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      _sum: { amount: true },
      where: {
        type: TransactionType.GENERAL_DONATION,
        status: TransactionStatus.SUCCESSFUL,
      },
    });
    expect(prisma.walletTransaction.aggregate).toHaveBeenCalledWith({
      _sum: { amount: true },
      where: {
        type: TransactionType.GENERAL_DONATION,
        direction: WalletTransactionDirection.DEBIT,
      },
    });
    expect(result.toFixed(2)).toBe('105.00');
  });

  it('creates an emergency coverage when the orphan has no active sponsorship or active coverage for the same sponsorship', async () => {
    tx.sponsorship.findFirst.mockResolvedValue(null);
    tx.orphanEmergencyCoverage.findFirst.mockResolvedValue(null);

    const result = await service.createEmergencyCoverageIfEligible(
      tx,
      { id: 5, orphanId: 3, amount: new Prisma.Decimal(10) },
      OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
      new Date('2026-08-01T09:00:00.000Z'),
    );

    expect(result).toBe(true);
    expect(tx.orphanEmergencyCoverage.create).toHaveBeenCalledWith({
      data: {
        orphanId: 3,
        sponsorshipId: 5,
        originalAmount: new Prisma.Decimal(10),
        monthlySupport: new Prisma.Decimal(5),
        supportedMonths: 0,
        startDate: new Date('2026-08-01T09:00:00.000Z'),
        status: OrphanEmergencyCoverageStatus.ACTIVE,
        reason: OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
      },
    });
  });

  it('does not create emergency coverage when another active sponsorship exists', async () => {
    tx.sponsorship.findFirst.mockResolvedValue({ id: 9 });
    tx.orphanEmergencyCoverage.findFirst.mockResolvedValue(null);

    const result = await service.createEmergencyCoverageIfEligible(
      tx,
      { id: 5, orphanId: 3, amount: new Prisma.Decimal(10) },
      OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
    );

    expect(result).toBe(false);
    expect(tx.orphanEmergencyCoverage.create).not.toHaveBeenCalled();
  });

  it('does not create emergency coverage when the sponsorship already has active coverage', async () => {
    tx.sponsorship.findFirst.mockResolvedValue(null);
    tx.orphanEmergencyCoverage.findFirst.mockResolvedValue({ id: 14 });

    const result = await service.createEmergencyCoverageIfEligible(
      tx,
      { id: 5, orphanId: 3, amount: new Prisma.Decimal(10) },
      OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
    );

    expect(result).toBe(false);
    expect(tx.orphanEmergencyCoverage.create).not.toHaveBeenCalled();
  });

  it('does not process monthly coverages before the renewal window opens', async () => {
    const result = await service.processMonthlyEmergencyCoverages(
      new Date('2026-08-19T09:00:00.000Z'),
    );

    expect(result).toBe(0);
    expect(prisma.orphanEmergencyCoverage.findMany).not.toHaveBeenCalled();
  });

  it('creates one fund support during the renewal window and increments supported months', async () => {
    const now = new Date('2026-08-20T09:00:00.000Z');
    prisma.orphanEmergencyCoverage.findMany.mockResolvedValue([{ id: 1 }]);
    mockActiveCoverage();

    const result = await service.processMonthlyEmergencyCoverages(now);

    expect(result).toBe(1);
    expect(tx.sponsorshipFundSupport.create).toHaveBeenCalledWith({
      data: {
        coverageId: 1,
        amount: new Prisma.Decimal(5),
        balanceAfter: new Prisma.Decimal(100),
        createdAt: now,
      },
    });
    expect(tx.orphanEmergencyCoverage.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { supportedMonths: 1 },
    });
  });

  it('does not repeat support in the same renewal window', async () => {
    prisma.orphanEmergencyCoverage.findMany.mockResolvedValue([{ id: 1 }]);
    mockActiveCoverage();
    tx.sponsorshipFundSupport.findFirst.mockResolvedValue({ id: 10 });

    const result = await service.processMonthlyEmergencyCoverages(
      new Date('2026-08-20T09:00:00.000Z'),
    );

    expect(result).toBe(0);
    expect(tx.sponsorshipFundSupport.create).not.toHaveBeenCalled();
    expect(tx.orphanEmergencyCoverage.update).not.toHaveBeenCalled();
  });

  it('completes coverage after the second support', async () => {
    const now = new Date('2026-08-20T09:00:00.000Z');
    prisma.orphanEmergencyCoverage.findMany.mockResolvedValue([{ id: 1 }]);
    mockActiveCoverage({ supportedMonths: 1 });

    await service.processMonthlyEmergencyCoverages(now);

    expect(tx.orphanEmergencyCoverage.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        supportedMonths: 2,
        status: OrphanEmergencyCoverageStatus.COMPLETED,
        endDate: now,
      },
    });
  });

  it('stops active coverage when a new active sponsorship exists before payment', async () => {
    const now = new Date('2026-08-20T09:00:00.000Z');
    prisma.orphanEmergencyCoverage.findMany.mockResolvedValue([{ id: 1 }]);
    mockActiveCoverage();
    tx.sponsorship.findFirst.mockResolvedValue({ id: 99 });

    const result = await service.processMonthlyEmergencyCoverages(now);

    expect(result).toBe(1);
    expect(tx.orphanEmergencyCoverage.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: OrphanEmergencyCoverageStatus.STOPPED_NEW_SPONSOR,
        endDate: now,
      },
    });
    expect(tx.sponsorshipFundSupport.create).not.toHaveBeenCalled();
  });

  it('stops coverage without creating support when fund balance is insufficient', async () => {
    const now = new Date('2026-08-20T09:00:00.000Z');
    prisma.orphanEmergencyCoverage.findMany.mockResolvedValue([{ id: 1 }]);
    mockActiveCoverage();
    mockFundBalance(2, 1, 0);

    const result = await service.processMonthlyEmergencyCoverages(now);

    expect(result).toBe(1);
    expect(tx.orphanEmergencyCoverage.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: OrphanEmergencyCoverageStatus.STOPPED_INSUFFICIENT_FUNDS,
        endDate: now,
      },
    });
    expect(tx.sponsorshipFundSupport.create).not.toHaveBeenCalled();
  });
});
