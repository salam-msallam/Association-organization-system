import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Status, UserType } from '@prisma/client';
import { SponsorshipService } from './sponsorship.service';

describe('SponsorshipService', () => {
  let prisma: any;
  let tx: any;
  let i18n: any;
  let service: SponsorshipService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 3 }]),
      wallet: {
        findUnique: jest.fn(),
      },
      sponsorship: {
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    prisma = {
      donor: {
        findUnique: jest.fn(),
      },
      sponsorship: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    i18n = {
      t: jest.fn((key: string, options?: any) => {
        const args = options?.args;
        return args
          ? `${key}:${args.walletBalance}:${args.requiredBalance}`
          : key;
      }),
    };
    service = new SponsorshipService(prisma, i18n);
  });

  it('rejects unauthenticated requests', async () => {
    await expect(service.createRequest({})).rejects.toThrow(
      UnauthorizedException,
    );

    expect(prisma.donor.findUnique).not.toHaveBeenCalled();
  });

  it('rejects authenticated users who are not donors', async () => {
    await expect(
      service.createRequest({ id: 4, type: UserType.BENEFICIARY }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.donor.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a donor token without a donor account', async () => {
    prisma.donor.findUnique.mockResolvedValue(null);

    await expect(
      service.createRequest({ id: 7, type: UserType.DONOR }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates the first pending request when the wallet contains exactly $30', async () => {
    const createdAt = new Date('2026-07-28T12:00:00.000Z');
    prisma.donor.findUnique.mockResolvedValue({ userId: 7 });
    tx.wallet.findUnique.mockResolvedValue({
      runningBalance: new Prisma.Decimal(30),
    });
    tx.sponsorship.count.mockResolvedValue(0);
    tx.sponsorship.create.mockResolvedValue({
      id: 42,
      donorId: 7,
      amount: new Prisma.Decimal(10),
      status: Status.PENDING,
      orphanId: null,
      employeeId: null,
      createdAt,
    });

    const result = await service.createRequest(
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.wallet.findUnique).toHaveBeenCalledWith({
      where: { donorId: 7 },
      select: { runningBalance: true },
    });
    expect(tx.sponsorship.count).toHaveBeenCalledWith({
      where: {
        donorId: 7,
        status: { in: [Status.PENDING, Status.ACCEPTED] },
      },
    });
    expect(tx.sponsorship.create).toHaveBeenCalledWith({
      data: {
        donorId: 7,
        amount: new Prisma.Decimal(10),
        status: Status.PENDING,
      },
      select: {
        id: true,
        donorId: true,
        amount: true,
        status: true,
        orphanId: true,
        employeeId: true,
        createdAt: true,
      },
    });
    expect(result).toEqual({
      success: true,
      message: 'sponsorship.REQUEST_CREATED',
      data: {
        id: 42,
        donorId: 7,
        monthlyAmount: '10.00',
        status: Status.PENDING,
        orphanId: null,
        employeeId: null,
        requiredWalletBalance: '30.00',
        walletBalance: '30.00',
        createdAt,
      },
    });
  });

  it('requires $30 for each existing pending or accepted sponsorship plus the new request', async () => {
    prisma.donor.findUnique.mockResolvedValue({ userId: 7 });
    tx.wallet.findUnique.mockResolvedValue({
      runningBalance: new Prisma.Decimal('59.99'),
    });
    tx.sponsorship.count.mockResolvedValue(1);

    await expect(
      service.createRequest({ id: 7, type: UserType.DONOR }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.sponsorship.create).not.toHaveBeenCalled();
    expect(i18n.t).toHaveBeenCalledWith(
      'sponsorship.INSUFFICIENT_WALLET_BALANCE',
      {
        lang: 'ar',
        args: {
          walletBalance: '59.99',
          requiredBalance: '60.00',
        },
      },
    );
  });

  it('treats a missing wallet as a zero balance', async () => {
    prisma.donor.findUnique.mockResolvedValue({ userId: 7 });
    tx.wallet.findUnique.mockResolvedValue(null);
    tx.sponsorship.count.mockResolvedValue(0);

    await expect(
      service.createRequest({ id: 7, type: UserType.DONOR }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.sponsorship.create).not.toHaveBeenCalled();
  });

  it('returns only the authenticated donor sponsorships filtered by status', async () => {
    const createdAt = new Date('2026-07-29T12:00:00.000Z');
    prisma.donor.findUnique.mockResolvedValue({ userId: 7 });
    prisma.sponsorship.findMany.mockResolvedValue([
      {
        id: 8,
        donorId: 7,
        amount: new Prisma.Decimal(10),
        status: Status.REJECTED,
        rejectionReason: {
          ar: 'الرصيد غير كافٍ',
          en: 'The balance is insufficient',
        },
        startDate: null,
        endDate: null,
        createdAt,
        orphan: {
          id: 3,
          firstName: 'Ahmad',
          lastName: 'Ali',
          birthOfDate: new Date('2015-04-12T00:00:00.000Z'),
          gender: 'MALE',
          class: { ar: 'الصف الخامس', en: 'Fifth grade' },
          talent: { ar: 'الرسم', en: 'Drawing' },
        },
      },
    ]);

    const result = await service.findMine(
      { id: 7, type: UserType.DONOR },
      'rejected',
      'ar',
    );

    expect(prisma.sponsorship.findMany).toHaveBeenCalledWith({
      where: { donorId: 7, status: Status.REJECTED },
      orderBy: { id: 'desc' },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      success: true,
      message: 'sponsorship.FETCH_SUCCESS',
      data: [
        expect.objectContaining({
          id: 8,
          donorId: 7,
          monthlyAmount: '10.00',
          status: Status.REJECTED,
          rejectionReason: 'الرصيد غير كافٍ',
          orphan: expect.objectContaining({
            id: 3,
            class: 'الصف الخامس',
            talent: 'الرسم',
          }),
        }),
      ],
    });
  });

  it('returns all statuses when the status filter is omitted', async () => {
    prisma.donor.findUnique.mockResolvedValue({ userId: 7 });
    prisma.sponsorship.findMany.mockResolvedValue([]);

    const result = await service.findMine({ id: 7, type: UserType.DONOR });

    expect(prisma.sponsorship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { donorId: 7 } }),
    );
    expect(result.data).toEqual([]);
  });

  it('rejects an invalid status filter with a localized error', async () => {
    await expect(
      service.findMine({ id: 7, type: UserType.DONOR }, 'not-a-status', 'en'),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('sponsorship.INVALID_STATUS', {
      lang: 'en',
      args: undefined,
    });
    expect(prisma.sponsorship.findMany).not.toHaveBeenCalled();
  });
});
