import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
  WalletTransactionDirection,
} from '@prisma/client';
import { DonorService } from './donor.service';

describe('DonorService', () => {
  let service: DonorService;
  let prisma: any;
  let i18n: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T12:00:00.000Z'));

    prisma = {
      donor: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      transaction: {
        findMany: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      walletTransaction: {},
      requestAid: {
        findMany: jest.fn(),
      },
      sponsorship: {
        findMany: jest.fn(),
      },
      orphan: {
        findMany: jest.fn(),
      },
    };
    i18n = {
      t: jest.fn((key: string, options?: any) => `${key}:${options?.lang ?? 'ar'}`),
    };

    service = new DonorService(prisma, i18n);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists donors with safe user fields, sponsor filter, and user createdAt', async () => {
    const createdAt = new Date('2026-07-20T09:30:00.000Z');
    prisma.donor.findMany.mockResolvedValue([
      {
        id: 3,
        userId: 7,
        isSponsor: true,
        user: {
          firstName: 'Ahmad',
          lastName: 'Saleh',
          email: 'ahmad@example.com',
          number: '959522414',
          countryCode: '+963',
          countryName: 'syria',
          createdAt,
        },
      },
    ]);
    prisma.donor.count.mockResolvedValue(1);

    const result = await service.findAll('1', '10', 'true', 'en');

    expect(prisma.donor.findMany).toHaveBeenCalledWith({
      where: { isSponsor: true },
      skip: 0,
      take: 10,
      orderBy: { user: { createdAt: 'desc' } },
      select: {
        id: true,
        userId: true,
        isSponsor: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            number: true,
            countryCode: true,
            countryName: true,
            createdAt: true,
          },
        },
      },
    });
    expect(result).toEqual({
      success: true,
      message: 'donor.FETCH_SUCCESS:en',
      data: [
        {
          donorId: 3,
          userId: 7,
          firstName: 'Ahmad',
          lastName: 'Saleh',
          email: 'ahmad@example.com',
          number: '959522414',
          countryCode: '+963',
          countryName: 'syria',
          isSponsor: true,
          createdAt,
        },
      ],
      meta: {
        totalCount: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it('rejects invalid pagination and isSponsor filters with translated errors', async () => {
    await expect(service.findAll('0', '10', undefined, 'en')).rejects.toThrow(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('donor.INVALID_PAGINATION', {
      lang: 'en',
    });

    await expect(service.findAll('1', '10', 'yes', 'ar')).rejects.toThrow(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('donor.INVALID_IS_SPONSOR', {
      lang: 'ar',
    });
  });

  it('rejects invalid donor history IDs and missing donors', async () => {
    await expect(service.getHistory('abc', 'en')).rejects.toThrow(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('donor.INVALID_ID', { lang: 'en' });

    prisma.donor.findUnique.mockResolvedValue(null);

    await expect(service.getHistory('3', 'en')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.donor.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { id: true, userId: true },
    });
    expect(i18n.t).toHaveBeenCalledWith('donor.NOT_FOUND', { lang: 'en' });
  });

  it('returns successful current-year direct and wallet history without duplicating top-ups', async () => {
    const directAidDate = new Date('2026-01-15T10:00:00.000Z');
    const topUpDate = new Date('2026-02-01T10:00:00.000Z');
    const generalDate = new Date('2026-03-01T10:00:00.000Z');
    const walletAidDate = new Date('2026-06-01T10:00:00.000Z');
    const sponsorshipDate = new Date('2026-07-01T10:00:00.000Z');

    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    prisma.transaction.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('50.00'),
        type: TransactionType.AID_REQUEST_DONATION,
        createdAt: directAidDate,
        referenceType: 'REQUEST_AID',
        referenceId: 13,
      },
      {
        amount: new Prisma.Decimal('100.00'),
        type: TransactionType.WALLET_TOP_UP,
        createdAt: topUpDate,
        referenceType: 'WALLET',
        referenceId: 9,
      },
      {
        amount: new Prisma.Decimal('25.00'),
        type: TransactionType.GENERAL_DONATION,
        createdAt: generalDate,
        referenceType: null,
        referenceId: null,
      },
    ]);
    prisma.wallet.findUnique.mockResolvedValue({
      id: 9,
      transactions: [
        {
          amount: new Prisma.Decimal('30.00'),
          type: TransactionType.AID_REQUEST_DONATION,
          createdAt: walletAidDate,
          referenceType: 'REQUEST_AID',
          referenceId: 21,
        },
        {
          amount: new Prisma.Decimal('75.00'),
          type: TransactionType.SPONSORSHIP_DONATION,
          createdAt: sponsorshipDate,
          referenceType: 'SPONSORSHIP',
          referenceId: 201,
        },
      ],
    });
    prisma.requestAid.findMany.mockResolvedValue([
      { id: 13, title: { ar: 'طلب مباشر', en: 'Direct request' } },
      { id: 21, title: { ar: 'طلب من المحفظة', en: 'Wallet request' } },
    ]);
    prisma.sponsorship.findMany.mockResolvedValue([
      {
        id: 201,
        orphan: {
          id: 5,
          firstName: 'Omar',
          lastName: 'Hassan',
        },
      },
    ]);
    prisma.orphan.findMany.mockResolvedValue([]);

    const result = await service.getHistory('3', 'en');

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          donorId: 7,
          status: TransactionStatus.SUCCESSFUL,
          createdAt: {
            gte: new Date(2026, 0, 1),
            lt: new Date(2027, 0, 1),
          },
          type: {
            in: [
              TransactionType.AID_REQUEST_DONATION,
              TransactionType.WALLET_TOP_UP,
              TransactionType.GENERAL_DONATION,
            ],
          },
        }),
      }),
    );
    expect(prisma.wallet.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { donorId: 7 },
        select: expect.objectContaining({
          transactions: expect.objectContaining({
            where: expect.objectContaining({
              direction: WalletTransactionDirection.DEBIT,
              type: {
                in: [
                  TransactionType.AID_REQUEST_DONATION,
                  TransactionType.SPONSORSHIP_DONATION,
                ],
              },
            }),
          }),
        }),
      }),
    );
    expect(prisma.requestAid.findMany).toHaveBeenCalledWith({
      where: { id: { in: [13, 21] } },
      select: { id: true, title: true },
    });
    expect(prisma.orphan.findMany).not.toHaveBeenCalled();
    expect(result.data).toEqual([
      {
        amount: '75.00',
        type: TransactionType.SPONSORSHIP_DONATION,
        createdAt: sponsorshipDate,
        orphan: {
          id: 5,
          firstName: 'Omar',
          lastName: 'Hassan',
        },
      },
      {
        amount: '30.00',
        type: TransactionType.AID_REQUEST_DONATION,
        createdAt: walletAidDate,
        aidRequest: {
          id: 21,
          title: { ar: 'طلب من المحفظة', en: 'Wallet request' },
        },
      },
      {
        amount: '25.00',
        type: TransactionType.GENERAL_DONATION,
        createdAt: generalDate,
      },
      {
        amount: '100.00',
        type: TransactionType.WALLET_TOP_UP,
        createdAt: topUpDate,
      },
      {
        amount: '50.00',
        type: TransactionType.AID_REQUEST_DONATION,
        createdAt: directAidDate,
        aidRequest: {
          id: 13,
          title: { ar: 'طلب مباشر', en: 'Direct request' },
        },
      },
    ]);
  });

  it('resolves wallet sponsorship reference IDs directly to orphans when no sponsorship exists', async () => {
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.wallet.findUnique.mockResolvedValue({
      id: 9,
      transactions: [
        {
          amount: new Prisma.Decimal('75.00'),
          type: TransactionType.SPONSORSHIP_DONATION,
          createdAt: new Date('2026-07-01T10:00:00.000Z'),
          referenceType: 'ORPHAN',
          referenceId: 5,
        },
      ],
    });
    prisma.requestAid.findMany.mockResolvedValue([]);
    prisma.sponsorship.findMany.mockResolvedValue([]);
    prisma.orphan.findMany.mockResolvedValue([
      {
        id: 5,
        firstName: 'Omar',
        lastName: 'Hassan',
      },
    ]);

    const result = await service.getHistory(3, 'en');

    expect(prisma.sponsorship.findMany).toHaveBeenCalledWith({
      where: { id: { in: [5] } },
      select: {
        id: true,
        orphan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    expect(prisma.orphan.findMany).toHaveBeenCalledWith({
      where: { id: { in: [5] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });
    expect(result.data[0].orphan).toEqual({
      id: 5,
      firstName: 'Omar',
      lastName: 'Hassan',
    });
  });

  it('returns an empty wallet history when the donor has no wallet', async () => {
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.wallet.findUnique.mockResolvedValue(null);

    const result = await service.getHistory(3, 'en');

    expect(prisma.requestAid.findMany).not.toHaveBeenCalled();
    expect(prisma.sponsorship.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'donor.HISTORY_FETCH_SUCCESS:en',
      data: [],
    });
  });
});
