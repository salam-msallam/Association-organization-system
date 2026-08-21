import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CancellationSource,
  OrphanEmergencyCoverageReason,
  Gender,
  Prisma,
  Status,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import { SponsorshipService } from './sponsorship.service';

describe('SponsorshipService', () => {
  let prisma: any;
  let tx: any;
  let i18n: any;
  let sponsorshipFundService: any;
  let notificationsService: any;
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
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
      },
      orphan: {
        findUnique: jest.fn().mockResolvedValue({ id: 3 }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      donor: {
        update: jest.fn(),
      },
      walletTransaction: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    prisma = {
      donor: {
        findUnique: jest.fn(),
      },
      sponsorship: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      walletTransaction: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
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
    sponsorshipFundService = {
      createEmergencyCoverageIfEligible: jest.fn(),
      stopActiveCoveragesForOrphan: jest.fn(),
    };
    notificationsService = {
      createAndSend: jest.fn().mockResolvedValue({
        notificationId: 1,
        pushSent: true,
      }),
      createAndSendToPermission: jest.fn().mockResolvedValue({
        recipientCount: 1,
        notificationCount: 1,
        pushSentCount: 1,
      }),
    };
    service = new SponsorshipService(
      prisma,
      i18n,
      sponsorshipFundService,
      notificationsService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
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
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    tx.wallet.findUnique.mockResolvedValue({
      runningBalance: new Prisma.Decimal(30),
    });
    tx.sponsorship.count.mockResolvedValue(0);
    tx.sponsorship.create.mockResolvedValue({
      id: 42,
      donorId: 3,
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
        donorId: 3,
        status: { in: [Status.PENDING, Status.ACCEPTED] },
      },
    });
    expect(tx.sponsorship.create).toHaveBeenCalledWith({
      data: {
        donorId: 3,
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
        donorId: 3,
        monthlyAmount: '10.00',
        status: Status.PENDING,
        orphanId: null,
        employeeId: null,
        requiredWalletBalance: '30.00',
        walletBalance: '30.00',
        createdAt,
      },
    });
    expect(notificationsService.createAndSendToPermission).toHaveBeenCalledWith(
      'status:sponsorships',
      {
        title: {
          ar: 'طلب كفالة جديد بانتظار المراجعة',
          en: 'New sponsorship request awaiting review',
        },
        message: {
          ar: 'تم تقديم طلب كفالة جديد ويحتاج إلى المراجعة.',
          en: 'A new sponsorship request has been submitted and requires review.',
        },
        targetType: 'SPONSORSHIP_REVIEW',
        targetId: 42,
      },
    );
    expect(tx.sponsorship.create.mock.invocationCallOrder[0]).toBeLessThan(
      notificationsService.createAndSendToPermission.mock
        .invocationCallOrder[0],
    );
  });

  it('keeps the pending sponsorship when staff notification fails', async () => {
    const createdAt = new Date('2026-07-28T12:00:00.000Z');
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    tx.wallet.findUnique.mockResolvedValue({
      runningBalance: new Prisma.Decimal(30),
    });
    tx.sponsorship.count.mockResolvedValue(0);
    tx.sponsorship.create.mockResolvedValue({
      id: 42,
      donorId: 3,
      amount: new Prisma.Decimal(10),
      status: Status.PENDING,
      orphanId: null,
      employeeId: null,
      createdAt,
    });
    notificationsService.createAndSendToPermission.mockRejectedValue(
      new Error('notification database error'),
    );

    await expect(
      service.createRequest({ id: 7, type: UserType.DONOR }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 42, status: Status.PENDING }),
      }),
    );
  });

  it('requires $30 for each existing pending or accepted sponsorship plus the new request', async () => {
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
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
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    tx.wallet.findUnique.mockResolvedValue(null);
    tx.sponsorship.count.mockResolvedValue(0);

    await expect(
      service.createRequest({ id: 7, type: UserType.DONOR }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.sponsorship.create).not.toHaveBeenCalled();
  });

  it('returns only the authenticated donor sponsorships filtered by status', async () => {
    const createdAt = new Date('2026-07-29T12:00:00.000Z');
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    prisma.sponsorship.findMany.mockResolvedValue([
      {
        id: 8,
        donorId: 3,
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
      where: { donorId: 3, status: Status.REJECTED },
      orderBy: { id: 'desc' },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      success: true,
      message: 'sponsorship.FETCH_SUCCESS',
      data: [
        expect.objectContaining({
          id: 8,
          donorId: 3,
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
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    prisma.sponsorship.findMany.mockResolvedValue([]);

    const result = await service.findMine({ id: 7, type: UserType.DONOR });

    expect(prisma.sponsorship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { donorId: 3 } }),
    );
    expect(result.data).toEqual([]);
  });

  it('returns a localized orphan summary after the first sponsorship payment', async () => {
    const birthOfDate = new Date('2015-04-12T00:00:00.000Z');
    prisma.donor.findUnique.mockResolvedValue({ id: 3 });
    prisma.sponsorship.findFirst.mockResolvedValue({
      id: 8,
      orphan: {
        id: 4,
        firstName: 'Ahmad',
        lastName: 'Hassan',
        birthOfDate,
        gender: Gender.MALE,
        class: { ar: 'الصف الرابع', en: 'Fourth grade' },
        talent: { ar: 'الرسم', en: 'Drawing' },
        Diseases: { ar: 'لا توجد أمراض', en: 'No diseases' },
      },
    });
    prisma.walletTransaction.findFirst.mockResolvedValue({ id: 101 });

    const result = await service.findOrphanSummary(
      8,
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(prisma.sponsorship.findFirst).toHaveBeenCalledWith({
      where: {
        id: 8,
        donorId: 3,
        status: Status.ACCEPTED,
      },
      select: expect.any(Object),
    });
    expect(prisma.walletTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: 'SPONSORSHIP',
        referenceId: 8,
      },
      select: { id: true },
    });
    expect(result).toEqual({
      success: true,
      message: 'sponsorship.ORPHAN_SUMMARY_FETCH_SUCCESS',
      data: {
        sponsorshipId: 8,
        orphan: {
          id: 4,
          firstName: 'Ahmad',
          lastName: 'Hassan',
          birthOfDate,
          gender: Gender.MALE,
          class: 'Fourth grade',
          talent: 'Drawing',
          diseases: 'No diseases',
        },
      },
    });
  });

  it('does not expose the orphan summary before the first payment', async () => {
    prisma.donor.findUnique.mockResolvedValue({ id: 3 });
    prisma.sponsorship.findFirst.mockResolvedValue({
      id: 8,
      orphan: {
        id: 4,
        firstName: 'Ahmad',
        lastName: 'Hassan',
        birthOfDate: new Date('2015-04-12T00:00:00.000Z'),
        gender: Gender.MALE,
        class: { ar: 'الصف الرابع', en: 'Fourth grade' },
        talent: { ar: 'الرسم', en: 'Drawing' },
        Diseases: { ar: 'لا توجد أمراض', en: 'No diseases' },
      },
    });
    prisma.walletTransaction.findFirst.mockResolvedValue(null);

    await expect(
      service.findOrphanSummary(8, { id: 7, type: UserType.DONOR }, 'ar'),
    ).rejects.toThrow(ForbiddenException);

    expect(i18n.t).toHaveBeenCalledWith(
      'sponsorship.ORPHAN_SUMMARY_PAYMENT_REQUIRED',
      { lang: 'ar', args: undefined },
    );
  });

  it('does not expose an orphan summary from another donor sponsorship', async () => {
    prisma.donor.findUnique.mockResolvedValue({ id: 3 });
    prisma.sponsorship.findFirst.mockResolvedValue(null);

    await expect(
      service.findOrphanSummary(99, { id: 7, type: UserType.DONOR }, 'en'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.walletTransaction.findFirst).not.toHaveBeenCalled();
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

  it('lists all sponsorship requests for staff with an optional status filter', async () => {
    const createdAt = new Date('2026-07-20T09:00:00.000Z');
    prisma.sponsorship.findMany.mockResolvedValue([
      {
        id: 5,
        amount: new Prisma.Decimal(10),
        status: Status.REJECTED,
        rejectionReason: {
          ar: 'سبب الرفض',
          en: 'Rejection reason',
        },
        startDate: null,
        endDate: null,
        cancellationSource: null,
        createdAt,
        donor: {
          id: 3,
          userId: 7,
          user: {
            firstName: 'Sara',
            lastName: 'Ali',
            email: 'sara@example.com',
            number: '934206455',
          },
        },
        orphan: null,
      },
    ]);
    prisma.sponsorship.count.mockResolvedValue(11);

    const result = await service.findAllForStaff('rejected', 'en', '2', '5');

    expect(prisma.sponsorship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: Status.REJECTED },
        skip: 5,
        take: 5,
      }),
    );
    expect(prisma.sponsorship.count).toHaveBeenCalledWith({
      where: { status: Status.REJECTED },
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 5,
        monthlyAmount: '10.00',
        rejectionReason: 'Rejection reason',
        donor: {
          id: 3,
          firstName: 'Sara',
          lastName: 'Ali',
          email: 'sara@example.com',
          number: '934206455',
        },
      }),
    );
    expect(result.meta).toEqual({
      totalCount: 11,
      page: 2,
      limit: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('rejects invalid admin sponsorship pagination', async () => {
    await expect(
      service.findAllForStaff(undefined, 'ar', '0', '10'),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('sponsorship.INVALID_PAGINATION', {
      lang: 'ar',
      args: undefined,
    });
    expect(prisma.sponsorship.findMany).not.toHaveBeenCalled();
  });

  it('returns one sponsorship request for staff with localized JSON fields', async () => {
    const createdAt = new Date('2026-07-20T09:00:00.000Z');
    prisma.sponsorship.findUnique.mockResolvedValue({
      id: 5,
      amount: new Prisma.Decimal(10),
      status: Status.REJECTED,
      rejectionReason: {
        ar: 'سبب الرفض',
        en: 'Rejection reason',
      },
      startDate: null,
      endDate: null,
      cancellationSource: null,
      createdAt,
      donor: {
        id: 3,
        userId: 7,
        user: {
          firstName: 'Sara',
          lastName: 'Ali',
          email: 'sara@example.com',
          number: '934206455',
        },
      },
      orphan: {
        id: 3,
        firstName: 'Ahmad',
        lastName: 'Ali',
        fatherName: 'Mohammad',
        motherName: 'Fatima',
        birthOfDate: new Date('2015-04-12T00:00:00.000Z'),
        gender: 'MALE',
        class: { ar: 'الصف الرابع', en: 'Fourth grade' },
        Diseases: { ar: 'لا توجد أمراض', en: 'No diseases' },
        FamilyStatement: 'uploads/orphans/family-statement.pdf',
        brotherAndSisterNumber: 3,
        guardianName: 'Mahmoud Hassan',
        guaranteedPhone: '+963933123456',
        bodySize: 130,
        shoesSize: 34,
        currentAddress: { ar: 'دمشق', en: 'Damascus' },
        previousAddress: { ar: 'حمص', en: 'Homs' },
        talent: { ar: 'الرسم', en: 'Drawing' },
        isSupported: true,
        createdAt,
        updatedAt: createdAt,
      },
    });

    const result = await service.findOneForStaff(5, 'ar');

    expect(prisma.sponsorship.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } }),
    );
    expect(result).toEqual({
      success: true,
      message: 'sponsorship.ADMIN_FETCH_ONE_SUCCESS',
      data: expect.objectContaining({
        id: 5,
        monthlyAmount: '10.00',
        rejectionReason: 'سبب الرفض',
        donor: {
          id: 3,
          firstName: 'Sara',
          lastName: 'Ali',
          email: 'sara@example.com',
          number: '934206455',
        },
        orphan: expect.objectContaining({
          id: 3,
          fatherName: 'Mohammad',
          class: 'الصف الرابع',
          Diseases: 'لا توجد أمراض',
          currentAddress: 'دمشق',
          previousAddress: 'حمص',
          talent: 'الرسم',
        }),
      }),
    });
  });

  it('returns not found when staff requests a missing sponsorship', async () => {
    prisma.sponsorship.findUnique.mockResolvedValue(null);

    await expect(service.findOneForStaff(999, 'en')).rejects.toThrow(
      NotFoundException,
    );

    expect(i18n.t).toHaveBeenCalledWith('sponsorship.NOT_FOUND', {
      lang: 'en',
      args: undefined,
    });
  });

  it('accepts a pending sponsorship for an orphan that may already have other sponsors', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T09:00:00.000Z'));
    tx.sponsorship.findUnique
      .mockResolvedValueOnce({ id: 5, donorId: 3, status: Status.PENDING })
      .mockResolvedValueOnce({
        id: 5,
        amount: new Prisma.Decimal(10),
        status: Status.ACCEPTED,
        rejectionReason: null,
        startDate: new Date('2026-07-25T00:00:00.000Z'),
        endDate: null,
        cancellationSource: null,
        createdAt: new Date('2026-07-10T09:00:00.000Z'),
        donor: {
          id: 3,
          userId: 7,
          user: {
            firstName: 'Sara',
            lastName: 'Ali',
            email: 'sara@example.com',
            number: '934206455',
          },
        },
        orphan: { id: 3, firstName: 'Ahmad', lastName: 'Ali' },
      });
    tx.employee.findUnique.mockResolvedValue({ id: 12 });
    tx.sponsorship.findFirst.mockResolvedValue(null);
    tx.sponsorship.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reviewStatus(
      5,
      20,
      { status: Status.ACCEPTED, orphanId: 3 },
      'en',
    );

    expect(tx.orphan.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { id: true },
    });
    expect(tx.sponsorship.findFirst).toHaveBeenCalledWith({
      where: {
        donorId: 3,
        orphanId: 3,
        status: Status.ACCEPTED,
      },
      select: { id: true },
    });
    expect(tx.orphan.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isSupported: true },
    });
    expect(tx.sponsorship.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: Status.PENDING },
      data: {
        status: Status.ACCEPTED,
        orphanId: 3,
        employeeId: 12,
        startDate: new Date('2026-07-25T00:00:00.000Z'),
        rejectionReason: Prisma.DbNull,
      },
    });
    expect(tx.donor.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isSponsor: true },
    });
    expect(
      sponsorshipFundService.stopActiveCoveragesForOrphan,
    ).toHaveBeenCalledWith(tx, 3, expect.any(Date));
    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 7,
      title: {
        ar: 'تم قبول طلب الكفالة',
        en: 'Your sponsorship request has been accepted',
      },
      message: {
        ar: 'تم قبول طلب الكفالة الخاص بك. يرجى دفع الدفعة الأولى المستحقة لشهر 2026-08.',
        en: 'Your sponsorship request has been accepted. Please pay the first installment due for 2026-08.',
      },
      targetType: 'SPONSORSHIP',
      targetId: 5,
      additionalData: {
        sponsorshipId: '5',
        coveredMonth: '2026-08',
      },
    });
    expect(result.data.status).toBe(Status.ACCEPTED);
  });

  it('rejects a missing orphan without accepting the sponsorship', async () => {
    tx.sponsorship.findUnique.mockResolvedValue({
      id: 5,
      donorId: 3,
      status: Status.PENDING,
    });
    tx.employee.findUnique.mockResolvedValue({ id: 12 });
    tx.orphan.findUnique.mockResolvedValue(null);

    await expect(
      service.reviewStatus(5, 20, {
        status: Status.ACCEPTED,
        orphanId: 3,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.sponsorship.updateMany).not.toHaveBeenCalled();
  });

  it('prevents the same donor from sponsoring the same orphan twice', async () => {
    tx.sponsorship.findUnique.mockResolvedValue({
      id: 5,
      donorId: 3,
      status: Status.PENDING,
    });
    tx.employee.findUnique.mockResolvedValue({ id: 12 });
    tx.sponsorship.findFirst.mockResolvedValue({ id: 4 });

    await expect(
      service.reviewStatus(
        5,
        20,
        { status: Status.ACCEPTED, orphanId: 3 },
        'en',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith(
      'sponsorship.DONOR_ALREADY_SPONSORS_ORPHAN',
      { lang: 'en', args: undefined },
    );
    expect(tx.sponsorship.updateMany).not.toHaveBeenCalled();
    expect(tx.orphan.update).not.toHaveBeenCalled();
  });

  it('rejects a pending sponsorship with a bilingual reason', async () => {
    tx.sponsorship.findUnique
      .mockResolvedValueOnce({ id: 5, donorId: 3, status: Status.PENDING })
      .mockResolvedValueOnce({
        id: 5,
        amount: new Prisma.Decimal(10),
        status: Status.REJECTED,
        rejectionReason: { ar: 'سبب الرفض', en: 'Rejection reason' },
        startDate: null,
        endDate: null,
        cancellationSource: null,
        createdAt: new Date('2026-07-10T09:00:00.000Z'),
        donor: {
          id: 3,
          userId: 7,
          user: {
            firstName: 'Sara',
            lastName: 'Ali',
            email: 'sara@example.com',
            number: '934206455',
          },
        },
        orphan: null,
      });
    tx.employee.findUnique.mockResolvedValue({ id: 12 });
    tx.sponsorship.updateMany.mockResolvedValue({ count: 1 });

    await service.reviewStatus(5, 20, {
      status: Status.REJECTED,
      rejectionReason: { ar: 'سبب الرفض', en: 'Rejection reason' },
    });

    expect(tx.sponsorship.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: Status.PENDING },
      data: {
        status: Status.REJECTED,
        employeeId: 12,
        rejectionReason: { ar: 'سبب الرفض', en: 'Rejection reason' },
      },
    });
    expect(tx.orphan.updateMany).not.toHaveBeenCalled();
    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 7,
      title: {
        ar: 'تم رفض طلب الكفالة',
        en: 'Your sponsorship request has been rejected',
      },
      message: {
        ar: 'تم رفض طلب الكفالة الخاص بك. لأن: سبب الرفض',
        en: 'Your sponsorship request has been rejected. because Rejection reason',
      },
      targetType: 'SPONSORSHIP',
      targetId: 5,
    });
  });

  it('cancels a pending request and stores the exact end time', async () => {
    const endDate = new Date('2026-07-31T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(endDate);
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    tx.sponsorship.findFirst.mockResolvedValue({
      id: 4,
      donorId: 3,
      status: Status.PENDING,
      orphanId: null,
      startDate: null,
    });
    tx.sponsorship.updateMany.mockResolvedValue({ count: 1 });
    tx.sponsorship.findUnique.mockResolvedValue({
      id: 4,
      donorId: 3,
      orphanId: null,
      status: Status.CANCELLED,
      startDate: null,
      endDate,
      cancellationSource: CancellationSource.DONOR,
    });

    const result = await service.cancel(
      4,
      { id: 7, type: UserType.DONOR },
      'ar',
    );

    expect(tx.sponsorship.updateMany).toHaveBeenCalledWith({
      where: { id: 4, donorId: 3, status: Status.PENDING },
      data: {
        status: Status.CANCELLED,
        endDate,
        cancellationSource: CancellationSource.DONOR,
      },
    });
    expect(tx.orphan.update).not.toHaveBeenCalled();
    expect(tx.donor.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'sponsorship.CANCEL_SUCCESS',
      data: expect.objectContaining({
        id: 4,
        status: Status.CANCELLED,
        startDate: null,
        endDate,
        cancellationSource: CancellationSource.DONOR,
        orphanReleased: false,
      }),
    });
    expect(
      notificationsService.createAndSendToPermission,
    ).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('cancels an accepted sponsorship and releases the orphan', async () => {
    const endDate = new Date('2026-07-31T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(endDate);
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    tx.sponsorship.findFirst.mockResolvedValue({
      id: 5,
      donorId: 3,
      status: Status.ACCEPTED,
      orphanId: 3,
      startDate: new Date('2026-06-01T00:00:00.000Z'),
    });
    tx.sponsorship.updateMany.mockResolvedValue({ count: 1 });
    tx.sponsorship.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    tx.sponsorship.findUnique.mockResolvedValue({
      id: 5,
      donorId: 3,
      orphanId: 3,
      status: Status.CANCELLED,
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate,
      cancellationSource: CancellationSource.DONOR,
    });

    const result = await service.cancel(5, {
      id: 7,
      type: UserType.DONOR,
    });

    expect(tx.sponsorship.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ endDate }),
      }),
    );
    expect(tx.orphan.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isSupported: false },
    });
    expect(tx.donor.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isSponsor: false },
    });
    expect(
      sponsorshipFundService.createEmergencyCoverageIfEligible,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: 5, orphanId: 3 }),
      OrphanEmergencyCoverageReason.SPONSOR_CANCELLED,
      endDate,
    );
    expect(result.data.orphanReleased).toBe(true);
    expect(notificationsService.createAndSendToPermission).toHaveBeenCalledWith(
      'status:sponsorships',
      {
        title: {
          ar: 'إلغاء كفالة من قبل المتبرع',
          en: 'Accepted sponsorship cancelled by donor',
        },
        message: {
          ar: 'قام المتبرع بإلغاء كفالته يرجى مراجعة تفاصيل الكفالة.',
          en: 'A donor cancelled an accepted sponsorship. Please review the sponsorship details.',
        },
        targetType: 'ACCEPTED_SPONSORSHIP_CANCELLED',
        targetId: 5,
      },
    );
    expect(tx.sponsorship.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      notificationsService.createAndSendToPermission.mock
        .invocationCallOrder[0],
    );
    jest.useRealTimers();
  });

  it('does not allow a rejected sponsorship to be cancelled', async () => {
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    tx.sponsorship.findFirst.mockResolvedValue({
      id: 6,
      donorId: 3,
      status: Status.REJECTED,
      orphanId: null,
      startDate: null,
    });

    await expect(
      service.cancel(6, { id: 7, type: UserType.DONOR }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.sponsorship.updateMany).not.toHaveBeenCalled();
  });

  it('does not reveal or cancel another donor sponsorship', async () => {
    prisma.donor.findUnique.mockResolvedValue({ id: 3, userId: 7 });
    tx.sponsorship.findFirst.mockResolvedValue(null);

    await expect(
      service.cancel(99, { id: 7, type: UserType.DONOR }),
    ).rejects.toThrow(NotFoundException);

    expect(tx.sponsorship.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 99, donorId: 3 } }),
    );
    expect(tx.sponsorship.updateMany).not.toHaveBeenCalled();
  });

  it('reminds about the overdue first installment on day 20', async () => {
    prisma.sponsorship.findMany.mockResolvedValue([
      {
        id: 5,
        startDate: new Date('2026-08-12T00:00:00.000Z'),
        donor: { userId: 7 },
      },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([]);

    const result = await service.sendSponsorshipPaymentReminders(
      new Date('2026-08-20T09:00:00.000Z'),
    );

    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 7,
      title: {
        ar: 'موعد دفع الكفالة',
        en: 'Sponsorship payment is due',
      },
      message: {
        ar: 'يرجى دفع دفعة الكفالة المستحقة لشهر 2026-08.',
        en: 'Please pay the sponsorship installment due for 2026-08.',
      },
      targetType: 'SPONSORSHIP_PAYMENT_REMINDER_DAY_20',
      targetId: 5,
      additionalData: {
        sponsorshipId: '5',
        coveredMonth: '2026-08',
        reminderStage: 'DAY_20',
      },
    });
    expect(result).toBe(1);
  });

  it('reminds about the next month on day 25 after the first installment was paid late', async () => {
    prisma.sponsorship.findMany.mockResolvedValue([
      {
        id: 5,
        startDate: new Date('2026-08-12T00:00:00.000Z'),
        donor: { userId: 7 },
      },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([
      {
        referenceId: 5,
        coveredMonth: '2026-08',
        createdAt: new Date('2026-08-22T09:00:00.000Z'),
      },
    ]);

    const result = await service.sendSponsorshipPaymentReminders(
      new Date('2026-08-25T09:00:00.000Z'),
    );

    expect(notificationsService.createAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'SPONSORSHIP_PAYMENT_REMINDER_DAY_25',
        targetId: 5,
        additionalData: {
          sponsorshipId: '5',
          coveredMonth: '2026-09',
          reminderStage: 'DAY_25',
        },
      }),
    );
    expect(result).toBe(1);
  });

  it('does not send a reminder when the covered month is already paid', async () => {
    prisma.sponsorship.findMany.mockResolvedValue([
      {
        id: 5,
        startDate: new Date('2026-08-12T00:00:00.000Z'),
        donor: { userId: 7 },
      },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([
      {
        referenceId: 5,
        coveredMonth: '2026-08',
        createdAt: new Date('2026-08-12T09:00:00.000Z'),
      },
      {
        referenceId: 5,
        coveredMonth: '2026-09',
        createdAt: new Date('2026-08-22T09:00:00.000Z'),
      },
    ]);

    const result = await service.sendSponsorshipPaymentReminders(
      new Date('2026-08-25T09:00:00.000Z'),
    );

    expect(notificationsService.createAndSend).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it('automatically cancels an accepted sponsorship missing the previous renewal payment', async () => {
    const now = new Date('2026-08-01T09:00:00.000Z');
    prisma.sponsorship.findMany.mockResolvedValue([
      { id: 5, startDate: new Date('2026-07-10T00:00:00.000Z') },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([]);
    tx.sponsorship.findFirst.mockResolvedValue({
      id: 5,
      donorId: 3,
      donor: { userId: 7 },
      orphanId: 3,
      status: Status.ACCEPTED,
      startDate: new Date('2026-07-10T00:00:00.000Z'),
    });
    tx.walletTransaction.findMany.mockResolvedValue([]);
    tx.sponsorship.updateMany.mockResolvedValue({ count: 1 });
    tx.sponsorship.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const result = await service.cancelOverdueSponsorships(now);

    expect(tx.sponsorship.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: Status.ACCEPTED },
      data: {
        status: Status.CANCELLED,
        endDate: now,
        cancellationSource: CancellationSource.AUTOMATIC,
      },
    });
    expect(tx.orphan.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isSupported: false },
    });
    expect(tx.donor.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isSponsor: false },
    });
    expect(
      sponsorshipFundService.createEmergencyCoverageIfEligible,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: 5, orphanId: 3 }),
      OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
      now,
    );
    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 7,
      title: {
        ar: 'تم إلغاء الكفالة تلقائياً',
        en: 'Your sponsorship has been automatically cancelled',
      },
      message: {
        ar: 'تم إلغاء كفالتك تلقائياً بسبب عدم دفع المبلغ المستحق.',
        en: 'Your sponsorship was automatically cancelled because the required payment was not made.',
      },
      targetType: 'SPONSORSHIP',
      targetId: 5,
    });
    expect(notificationsService.createAndSendToPermission).toHaveBeenCalledWith(
      'status:sponsorships',
      {
        title: {
          ar: 'إلغاء كفالة تلقائياً بسبب عدم الدفع',
          en: 'Sponsorship automatically cancelled for non-payment',
        },
        message: {
          ar: 'تم إلغاء كفالة تلقائياً بسبب عدم دفع المبلغ المستحق، يرجى مراجعة تفاصيل الكفالة.',
          en: 'A sponsorship was automatically cancelled because the required payment was not made. Please review its details.',
        },
        targetType: 'AUTOMATIC_SPONSORSHIP_CANCELLED',
        targetId: 5,
      },
    );
    expect(result).toBe(1);
  });

  it('keeps an accepted sponsorship when the previous renewal payment exists', async () => {
    prisma.sponsorship.findMany.mockResolvedValue([
      { id: 5, startDate: new Date('2026-06-10T00:00:00.000Z') },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([
      {
        referenceId: 5,
        coveredMonth: '2026-08',
        createdAt: new Date('2026-07-22T09:00:00.000Z'),
      },
    ]);

    const result = await service.cancelOverdueSponsorships(
      new Date('2026-08-01T09:00:00.000Z'),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notificationsService.createAndSend).not.toHaveBeenCalled();
    expect(
      notificationsService.createAndSendToPermission,
    ).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
