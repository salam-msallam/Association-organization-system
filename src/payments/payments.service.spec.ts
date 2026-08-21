import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let prisma: any;
  let configService: any;
  let i18n: any;
  let stripe: any;
  let notificationsService: any;
  let service: PaymentsService;

  const donor = {
    id: 3,
    userId: 7,
    stripeCustomerId: null,
    isSponsor: false,
    user: {
      firstName: 'Sara',
      lastName: 'Ali',
      email: 'sara@example.com',
      countryCode: '+963',
      number: '934206455',
    },
  };

  beforeEach(() => {
    prisma = {
      donor: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      requestAid: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      sponsorship: {
        findFirst: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      wallet: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          STRIPE_SECRET_KEY: 'rk_test_123',
          STRIPE_WEBHOOK_SECRET: 'whsec_123',
          STRIPE_CURRENCY: 'usd',
        };
        return values[key];
      }),
    };
    i18n = {
      t: jest.fn((key: string, options?: any) => {
        if (options?.args?.remainingAmount) {
          return `${key}:${options.lang}:${options.args.remainingAmount}`;
        }

        return `${key}:${options?.lang ?? 'ar'}`;
      }),
    };
    stripe = {
      customers: {
        create: jest.fn(),
      },
      paymentIntents: {
        create: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
    notificationsService = {
      createAndSend: jest.fn().mockResolvedValue({
        notificationId: 1,
        pushSent: true,
      }),
    };
    service = new PaymentsService(
      prisma,
      configService,
      i18n,
      notificationsService,
    );
    (service as any).stripe = stripe;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function mockValidDonationSetup() {
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.requestAid.findFirst.mockResolvedValue({
      id: 13,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(40),
    });
    stripe.customers.create.mockResolvedValue({ id: 'cus_123' });
    prisma.donor.update.mockResolvedValue({
      ...donor,
      stripeCustomerId: 'cus_123',
    });
    prisma.transaction.create.mockResolvedValue({
      id: 55,
      amount: new Prisma.Decimal(25),
      idempotencyKey: 'payment-intent:uuid-aid',
    });
    stripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret_abc',
    });
    prisma.transaction.update.mockResolvedValue({});
  }

  function createWalletDonationTx() {
    return {
      sponsorship: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      requestAid: {
        findFirst: jest.fn().mockResolvedValue({
          id: 13,
          cost: new Prisma.Decimal(100),
          currentPayment: new Prisma.Decimal(40),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 13,
          cost: new Prisma.Decimal(100),
          currentPayment: new Prisma.Decimal(65),
        }),
      },
      wallet: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 9,
            runningBalance: new Prisma.Decimal(100),
          })
          .mockResolvedValueOnce({
            id: 9,
            runningBalance: new Prisma.Decimal(75),
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 101 }),
      },
    };
  }

  function mockValidWalletDonationSetup() {
    const tx = createWalletDonationTx();
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    return tx;
  }

  function createSponsorshipFundWalletDonationTx() {
    return {
      wallet: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 9,
            runningBalance: new Prisma.Decimal(100),
          })
          .mockResolvedValueOnce({
            runningBalance: new Prisma.Decimal(50),
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 130 }),
      },
    };
  }

  function mockValidSponsorshipFundWalletDonationSetup() {
    const tx = createSponsorshipFundWalletDonationTx();
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    return tx;
  }

  function createSponsorshipPaymentTx() {
    return {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 5 }]),
      sponsorship: {
        findFirst: jest.fn().mockResolvedValue({
          id: 5,
          amount: new Prisma.Decimal(10),
        }),
      },
      wallet: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 9,
            runningBalance: new Prisma.Decimal(100),
          })
          .mockResolvedValueOnce({
            runningBalance: new Prisma.Decimal(90),
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      walletTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 115,
          createdAt: new Date('2026-07-10T09:00:00.000Z'),
        }),
      },
    };
  }

  function mockValidSponsorshipPaymentSetup() {
    const tx = createSponsorshipPaymentTx();
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    return tx;
  }

  function mockValidWalletTopUpSetup() {
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.wallet.upsert.mockResolvedValue({ id: 9 });
    stripe.customers.create.mockResolvedValue({ id: 'cus_123' });
    prisma.donor.update.mockResolvedValue({
      ...donor,
      stripeCustomerId: 'cus_123',
    });
    prisma.transaction.create.mockResolvedValue({
      id: 77,
      amount: new Prisma.Decimal(50),
      idempotencyKey: 'payment-intent:uuid-topup',
    });
    stripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_topup',
      client_secret: 'pi_topup_secret_abc',
    });
    prisma.transaction.update.mockResolvedValue({});
  }

  it('rejects non-donor users', async () => {
    await expect(
      service.createAidRequestPaymentIntent(
        13,
        { amount: 25 },
        { id: 1, type: UserType.BENEFICIARY },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.donor.findUnique).not.toHaveBeenCalled();
  });

  it('rejects users without a donor record', async () => {
    prisma.donor.findUnique.mockResolvedValue(null);

    await expect(
      service.createAidRequestPaymentIntent(
        13,
        { amount: 25 },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects missing or unaccepted aid requests', async () => {
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.requestAid.findFirst.mockResolvedValue(null);

    await expect(
      service.createAidRequestPaymentIntent(
        13,
        { amount: 25 },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.requestAid.findFirst).toHaveBeenCalledWith({
      where: { id: 13, status: Status.ACCEPTED },
      select: { id: true, cost: true, currentPayment: true },
    });
  });

  it.each([0, -1, 1.999])('rejects invalid amount %s', async (amount) => {
    await expect(
      service.createAidRequestPaymentIntent(
        13,
        { amount },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects amounts greater than the remaining aid request amount', async () => {
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.requestAid.findFirst.mockResolvedValue({
      id: 13,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(90),
    });

    await expect(
      service.createAidRequestPaymentIntent(
        13,
        { amount: 25 },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a Stripe customer, local transaction, and PaymentIntent', async () => {
    mockValidDonationSetup();

    const result = await service.createAidRequestPaymentIntent(
      13,
      { amount: 25 },
      { id: 7, type: UserType.DONOR },
    );

    expect(stripe.customers.create).toHaveBeenCalledWith({
      email: 'sara@example.com',
      name: 'Sara Ali',
      phone: '+963934206455',
      metadata: { donorId: '7', userId: '7' },
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: {
        donorId: 7,
        idempotencyKey: expect.stringMatching(/^payment-intent:/),
        amount: new Prisma.Decimal(25),
        status: TransactionStatus.PENDING,
        type: TransactionType.AID_REQUEST_DONATION,
        referenceType: 'REQUEST_AID',
        referenceId: 13,
        currency: 'usd',
      },
      select: { id: true, amount: true, idempotencyKey: true },
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 2500,
        currency: 'usd',
        customer: 'cus_123',
        automatic_payment_methods: { enabled: true },
        metadata: {
          transactionId: '55',
          donorId: '7',
          requestId: '13',
        },
      },
      { idempotencyKey: 'payment-intent:uuid-aid' },
    );
    expect(prisma.transaction.create.mock.invocationCallOrder[0]).toBeLessThan(
      stripe.paymentIntents.create.mock.invocationCallOrder[0],
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { stripePaymentIntentId: 'pi_123' },
    });
    expect(result).toEqual({
      transactionId: 55,
      clientSecret: 'pi_123_secret_abc',
      amount: '25.00',
      currency: 'usd',
    });
  });

  it('reuses an existing Stripe customer ID', async () => {
    mockValidDonationSetup();
    prisma.donor.findUnique.mockResolvedValue({
      ...donor,
      stripeCustomerId: 'cus_existing',
    });

    await service.createAidRequestPaymentIntent(
      13,
      { amount: 25 },
      { id: 7, type: UserType.DONOR },
    );

    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create.mock.calls[0][0].customer).toBe(
      'cus_existing',
    );
  });

  it.each(['0', '-1', '1.999', 'abc'])(
    'rejects invalid wallet top-up amount %s',
    async (amount) => {
      await expect(
        service.createWalletTopUpPaymentIntent(
          { amount },
          { id: 7, type: UserType.DONOR },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('creates a wallet top-up transaction and Stripe PaymentIntent', async () => {
    mockValidWalletTopUpSetup();

    const result = await service.createWalletTopUpPaymentIntent(
      { amount: '50.00' },
      { id: 7, type: UserType.DONOR },
    );

    expect(prisma.wallet.upsert).toHaveBeenCalledWith({
      where: { donorId: 7 },
      create: {
        donorId: 7,
        runningBalance: new Prisma.Decimal(0),
      },
      update: {},
      select: { id: true },
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: {
        donorId: 7,
        idempotencyKey: expect.stringMatching(/^payment-intent:/),
        amount: new Prisma.Decimal('50.00'),
        status: TransactionStatus.PENDING,
        type: TransactionType.WALLET_TOP_UP,
        referenceType: 'WALLET',
        referenceId: 9,
        currency: 'usd',
      },
      select: { id: true, amount: true, idempotencyKey: true },
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 5000,
        currency: 'usd',
        customer: 'cus_123',
        automatic_payment_methods: { enabled: true },
        metadata: {
          transactionId: '77',
          donorId: '7',
          walletId: '9',
          type: TransactionType.WALLET_TOP_UP,
        },
      },
      { idempotencyKey: 'payment-intent:uuid-topup' },
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { stripePaymentIntentId: 'pi_topup' },
    });
    expect(result).toEqual({
      transactionId: 77,
      clientSecret: 'pi_topup_secret_abc',
      amount: '50.00',
      currency: 'usd',
    });
  });

  it('creates a sponsorship fund Stripe transaction without references', async () => {
    prisma.donor.findUnique.mockResolvedValue(donor);
    stripe.customers.create.mockResolvedValue({ id: 'cus_123' });
    prisma.donor.update.mockResolvedValue({
      ...donor,
      stripeCustomerId: 'cus_123',
    });
    prisma.transaction.create.mockResolvedValue({
      id: 88,
      amount: new Prisma.Decimal(50),
      idempotencyKey: 'payment-intent:uuid-fund',
    });
    stripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_fund',
      client_secret: 'pi_fund_secret_abc',
    });
    prisma.transaction.update.mockResolvedValue({});

    const result = await service.createSponsorshipFundPaymentIntent(
      { amount: 50 },
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: {
        donorId: 7,
        idempotencyKey: expect.stringMatching(/^payment-intent:/),
        amount: new Prisma.Decimal(50),
        status: TransactionStatus.PENDING,
        type: TransactionType.GENERAL_DONATION,
        referenceType: null,
        referenceId: null,
        currency: 'usd',
      },
      select: { id: true, amount: true, idempotencyKey: true },
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 5000,
        currency: 'usd',
        customer: 'cus_123',
        automatic_payment_methods: { enabled: true },
        metadata: {
          transactionId: '88',
          donorId: '7',
          type: TransactionType.GENERAL_DONATION,
        },
      },
      { idempotencyKey: 'payment-intent:uuid-fund' },
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 88 },
      data: { stripePaymentIntentId: 'pi_fund' },
    });
    expect(result).toEqual({
      transactionId: 88,
      clientSecret: 'pi_fund_secret_abc',
      amount: '50.00',
      currency: 'usd',
    });
  });

  it('reuses an existing Stripe customer ID for wallet top-ups', async () => {
    mockValidWalletTopUpSetup();
    prisma.donor.findUnique.mockResolvedValue({
      ...donor,
      stripeCustomerId: 'cus_existing',
    });

    await service.createWalletTopUpPaymentIntent(
      { amount: '50.00' },
      { id: 7, type: UserType.DONOR },
    );

    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create.mock.calls[0][0].customer).toBe(
      'cus_existing',
    );
  });

  it('returns the authenticated donor wallet running balance in USD', async () => {
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.wallet.upsert.mockResolvedValue({
      runningBalance: new Prisma.Decimal('250'),
    });

    const result = await service.getWalletBalance(
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(prisma.wallet.upsert).toHaveBeenCalledWith({
      where: { donorId: 7 },
      create: {
        donorId: 7,
        runningBalance: new Prisma.Decimal(0),
      },
      update: {},
      select: { runningBalance: true },
    });
    expect(result).toEqual({
      success: true,
      data: {
        balance: '250.00',
        currency: 'USD',
      },
    });
  });

  it('creates a zero-balance wallet when retrieving balance for a donor without a wallet', async () => {
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.wallet.upsert.mockResolvedValue({
      runningBalance: new Prisma.Decimal(0),
    });

    await expect(
      service.getWalletBalance({ id: 7, type: UserType.DONOR }, 'en'),
    ).resolves.toEqual({
      success: true,
      data: {
        balance: '0.00',
        currency: 'USD',
      },
    });
  });

  it('donates to an accepted aid request from the donor wallet without Stripe or Transaction', async () => {
    const tx = mockValidWalletDonationSetup();

    const result = await service.donateWalletToAidRequest(
      13,
      { amount: '25.00' },
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(tx.sponsorship.findFirst).toHaveBeenCalledWith({
      where: {
        donorId: 3,
        status: { in: [Status.PENDING, Status.ACCEPTED] },
      },
      select: { id: true },
    });
    expect(tx.requestAid.findFirst).toHaveBeenCalledWith({
      where: { id: 13, status: Status.ACCEPTED },
      select: { id: true, cost: true, currentPayment: true },
    });
    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: {
        id: 9,
        runningBalance: { gte: new Prisma.Decimal('25.00') },
      },
      data: {
        runningBalance: { decrement: new Prisma.Decimal('25.00') },
      },
    });
    expect(tx.requestAid.updateMany).toHaveBeenCalledWith({
      where: {
        id: 13,
        status: Status.ACCEPTED,
        currentPayment: { lte: new Prisma.Decimal(75) },
      },
      data: {
        currentPayment: { increment: new Prisma.Decimal('25.00') },
      },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        walletId: 9,
        transactionId: null,
        amount: new Prisma.Decimal('25.00'),
        type: TransactionType.AID_REQUEST_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: 'REQUEST_AID',
        referenceId: 13,
        balanceAfter: new Prisma.Decimal(75),
      },
      select: { id: true },
    });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      walletTransactionId: 101,
      donatedAmount: '25.00',
      balanceAfter: '75.00',
      requestId: 13,
      currentPayment: '65.00',
      remainingAmount: '35.00',
      compliancePercentage: '65.00',
    });
    expect(notificationsService.createAndSend).not.toHaveBeenCalled();
  });

  it('notifies the beneficiary when a wallet donation fully funds an aid request', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.requestAid.findFirst.mockResolvedValue({
      id: 13,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(75),
    });
    tx.requestAid.findUnique.mockResolvedValue({
      id: 13,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(100),
    });
    prisma.requestAid.findUnique.mockResolvedValue({
      beneficiary: { userId: 19 },
    });

    const result = await service.donateWalletToAidRequest(
      13,
      { amount: '25.00' },
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(result.remainingAmount).toBe('0.00');
    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 19,
      title: {
        ar: 'تم تمويل طلب الإعانة بالكامل',
        en: 'Your assistance request has been fully funded',
      },
      message: {
        ar: 'اكتمل تمويل طلب الإعانة الخاص بك بالكامل.',
        en: 'Your assistance request has now received full funding.',
      },
      targetType: 'REQUEST_AID',
      targetId: 13,
    });
  });

  it('pays the first accepted sponsorship installment from the wallet without Stripe', async () => {
    const now = new Date('2026-07-10T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const tx = mockValidSponsorshipPaymentSetup();

    const result = await service.donateWalletToSponsorship(
      5,
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.sponsorship.findFirst).toHaveBeenCalledWith({
      where: { id: 5, donorId: 3, status: Status.ACCEPTED },
      select: { id: true, amount: true },
    });
    expect(tx.walletTransaction.findMany).toHaveBeenCalledWith({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: 'SPONSORSHIP',
        referenceId: 5,
        createdAt: {
          gte: new Date('2026-06-30T21:00:00.000Z'),
          lt: new Date('2026-07-31T21:00:00.000Z'),
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });
    expect(tx.walletTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: 'SPONSORSHIP',
        referenceId: 5,
        createdAt: { lt: new Date('2026-06-30T21:00:00.000Z') },
      },
      select: { id: true },
    });
    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: {
        id: 9,
        runningBalance: { gte: new Prisma.Decimal(10) },
      },
      data: {
        runningBalance: { decrement: new Prisma.Decimal(10) },
      },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        walletId: 9,
        transactionId: null,
        amount: new Prisma.Decimal(10),
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: 'SPONSORSHIP',
        referenceId: 5,
        balanceAfter: new Prisma.Decimal(90),
        createdAt: now,
      },
      select: { id: true, createdAt: true },
    });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'payments.SPONSORSHIP_PAYMENT_SUCCESS:en',
      data: {
        walletTransactionId: 115,
        sponsorshipId: 5,
        paidAmount: '10.00',
        balanceAfter: '90.00',
        coveredMonth: '2026-07',
        paidAt: now,
      },
    });
    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 7,
      title: {
        ar: 'تم دفع دفعة الكفالة بنجاح',
        en: 'Sponsorship payment successful',
      },
      message: {
        ar: 'تم تسجيل دفعة كفالتك لشهر 2026-07 بقيمة 10.00 دولار أمريكي بنجاح.',
        en: 'Your sponsorship payment of USD 10.00 for 2026-07 was recorded successfully.',
      },
      targetType: 'SPONSORSHIP_PAYMENT',
      targetId: 115,
      additionalData: {
        sponsorshipId: '5',
        coveredMonth: '2026-07',
        paidAmount: '10.00',
      },
    });
    expect(
      tx.walletTransaction.create.mock.invocationCallOrder[0],
    ).toBeLessThan(
      notificationsService.createAndSend.mock.invocationCallOrder[0],
    );
  });

  it('keeps a successful sponsorship payment when notification creation fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T09:00:00.000Z'));
    mockValidSponsorshipPaymentSetup();
    notificationsService.createAndSend.mockRejectedValue(
      new Error('notification database error'),
    );

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ walletTransactionId: 115 }),
      }),
    );
  });

  it('treats a first payment on or after day 20 as next-month coverage', async () => {
    const now = new Date('2026-07-25T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const tx = mockValidSponsorshipPaymentSetup();
    tx.walletTransaction.create.mockResolvedValue({ id: 116, createdAt: now });

    const result = await service.donateWalletToSponsorship(5, {
      id: 7,
      type: UserType.DONOR,
    });

    expect(result.data.coveredMonth).toBe('2026-08');
    expect(tx.walletTransaction.findMany).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.findFirst).toHaveBeenCalledTimes(1);
  });

  it('allows the first sponsorship payment before day 20 and its renewal after day 20 in the same month', async () => {
    const now = new Date('2026-07-25T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const tx = mockValidSponsorshipPaymentSetup();
    tx.walletTransaction.findMany.mockResolvedValueOnce([
      { id: 100, createdAt: new Date('2026-07-10T09:00:00.000Z') },
    ]);
    tx.walletTransaction.create.mockResolvedValue({ id: 116, createdAt: now });

    const result = await service.donateWalletToSponsorship(5, {
      id: 7,
      type: UserType.DONOR,
    });

    expect(result.data.coveredMonth).toBe('2026-08');
    expect(tx.wallet.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a duplicate sponsorship payment before day 20 with conflict', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T09:00:00.000Z'));
    const tx = mockValidSponsorshipPaymentSetup();
    tx.walletTransaction.findMany.mockResolvedValueOnce([
      { id: 100, createdAt: new Date('2026-07-10T09:00:00.000Z') },
    ]);

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.wallet.findUnique).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(notificationsService.createAndSend).not.toHaveBeenCalled();
  });

  it('rejects a duplicate sponsorship payment after day 20 with conflict', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T09:00:00.000Z'));
    const tx = mockValidSponsorshipPaymentSetup();
    tx.walletTransaction.findMany.mockResolvedValueOnce([
      { id: 101, createdAt: new Date('2026-07-22T09:00:00.000Z') },
    ]);

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.wallet.findUnique).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(notificationsService.createAndSend).not.toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.walletTransaction.findMany.mock.invocationCallOrder[0],
    );
  });

  it('rejects a third same-month payment after the first-month renewal', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T09:00:00.000Z'));
    const tx = mockValidSponsorshipPaymentSetup();
    tx.walletTransaction.findMany.mockResolvedValueOnce([
      { id: 100, createdAt: new Date('2026-07-10T09:00:00.000Z') },
      { id: 101, createdAt: new Date('2026-07-22T09:00:00.000Z') },
    ]);

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('does not allow the first-month exception when an older payment exists', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T09:00:00.000Z'));
    const tx = mockValidSponsorshipPaymentSetup();
    tx.walletTransaction.findMany.mockResolvedValueOnce([
      { id: 100, createdAt: new Date('2026-07-10T09:00:00.000Z') },
    ]);
    tx.walletTransaction.findFirst.mockResolvedValueOnce({ id: 99 });

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects renewal before day 20 when a first payment already exists', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
    const tx = mockValidSponsorshipPaymentSetup();
    tx.walletTransaction.findFirst.mockResolvedValueOnce({ id: 100 });

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('does not reveal or pay an accepted sponsorship owned by another donor', async () => {
    const tx = mockValidSponsorshipPaymentSetup();
    tx.sponsorship.findFirst.mockResolvedValue(null);

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('does not create a sponsorship payment when the wallet balance is insufficient', async () => {
    const tx = mockValidSponsorshipPaymentSetup();
    tx.wallet.findUnique.mockReset().mockResolvedValueOnce({
      id: 9,
      runningBalance: new Prisma.Decimal(5),
    });

    await expect(
      service.donateWalletToSponsorship(5, {
        id: 7,
        type: UserType.DONOR,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects wallet donations with insufficient balance', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.wallet.findUnique = jest.fn().mockResolvedValueOnce({
      id: 9,
      runningBalance: new Prisma.Decimal(20),
    });

    await expect(
      service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects wallet donations greater than the remaining aid request amount', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.requestAid.findFirst.mockResolvedValueOnce({
      id: 13,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(90),
    });

    await expect(
      service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.wallet.findUnique).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects wallet donations to unaccepted aid requests', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.requestAid.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(NotFoundException);

    expect(tx.requestAid.findFirst).toHaveBeenCalledWith({
      where: { id: 13, status: Status.ACCEPTED },
      select: { id: true, cost: true, currentPayment: true },
    });
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects wallet donations when the donor has a pending sponsorship', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.sponsorship.findFirst.mockResolvedValueOnce({ id: 201 });

    await expect(
      service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(tx.requestAid.findFirst).not.toHaveBeenCalled();
  });

  it('rejects wallet donations when the donor has an accepted sponsorship', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.sponsorship.findFirst.mockResolvedValueOnce({ id: 202 });

    await expect(
      service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(tx.sponsorship.findFirst).toHaveBeenCalledWith({
      where: {
        donorId: 3,
        status: { in: [Status.PENDING, Status.ACCEPTED] },
      },
      select: { id: true },
    });
  });

  it.each([Status.REJECTED, Status.CANCELLED])(
    'does not treat %s sponsorships as wallet donation blockers',
    async (status) => {
      const tx = mockValidWalletDonationSetup();

      await service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      );

      expect(
        tx.sponsorship.findFirst.mock.calls[0][0].where.status.in,
      ).not.toContain(status);
      expect(tx.walletTransaction.create).toHaveBeenCalled();
    },
  );

  it('rejects the second concurrent wallet donation when the wallet balance was already used', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.wallet.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.requestAid.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects a concurrent wallet donation when the remaining aid request amount changed', async () => {
    const tx = mockValidWalletDonationSetup();
    tx.requestAid.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.donateWalletToAidRequest(
        13,
        { amount: '25.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('donates to the sponsorship fund from wallet without creating a Transaction', async () => {
    const tx = mockValidSponsorshipFundWalletDonationSetup();

    const result = await service.donateWalletToSponsorshipFund(
      { amount: '50.00' },
      { id: 7, type: UserType.DONOR },
      'en',
    );

    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: {
        id: 9,
        runningBalance: { gte: new Prisma.Decimal('50.00') },
      },
      data: {
        runningBalance: { decrement: new Prisma.Decimal('50.00') },
      },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        walletId: 9,
        transactionId: null,
        amount: new Prisma.Decimal('50.00'),
        type: TransactionType.GENERAL_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: null,
        referenceId: null,
        balanceAfter: new Prisma.Decimal(50),
      },
      select: { id: true },
    });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'payments.SPONSORSHIP_FUND_DONATION_SUCCESS:en',
      data: {
        walletTransactionId: 130,
        donatedAmount: '50.00',
        balanceAfter: '50.00',
        currency: 'USD',
      },
    });
  });

  it('rejects sponsorship fund wallet donations from sponsors', async () => {
    prisma.donor.findUnique.mockResolvedValue({ ...donor, isSponsor: true });

    await expect(
      service.donateWalletToSponsorshipFund(
        { amount: '50.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['0', '1', '1.999', 'abc'])(
    'rejects invalid sponsorship fund wallet amount %s',
    async (amount) => {
      await expect(
        service.donateWalletToSponsorshipFund(
          { amount },
          { id: 7, type: UserType.DONOR },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects sponsorship fund wallet donations when the wallet is missing', async () => {
    const tx = mockValidSponsorshipFundWalletDonationSetup();
    tx.wallet.findUnique.mockReset().mockResolvedValueOnce(null);

    await expect(
      service.donateWalletToSponsorshipFund(
        { amount: '50.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(NotFoundException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects sponsorship fund wallet donations with insufficient balance', async () => {
    const tx = mockValidSponsorshipFundWalletDonationSetup();
    tx.wallet.findUnique.mockReset().mockResolvedValueOnce({
      id: 9,
      runningBalance: new Prisma.Decimal(25),
    });

    await expect(
      service.donateWalletToSponsorshipFund(
        { amount: '50.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects concurrent sponsorship fund wallet donations when balance changed', async () => {
    const tx = mockValidSponsorshipFundWalletDonationSetup();
    tx.wallet.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.donateWalletToSponsorshipFund(
        { amount: '50.00' },
        { id: 7, type: UserType.DONOR },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('increments aid request payment only once for repeated succeeded webhooks', async () => {
    const tx = {
      transaction: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 55,
            donorId: 7,
            amount: new Prisma.Decimal(25),
            status: TransactionStatus.PENDING,
            type: TransactionType.AID_REQUEST_DONATION,
            referenceType: 'REQUEST_AID',
            referenceId: 13,
          })
          .mockResolvedValueOnce({
            id: 55,
            donorId: 7,
            amount: new Prisma.Decimal(25),
            status: TransactionStatus.SUCCESSFUL,
            type: TransactionType.AID_REQUEST_DONATION,
            referenceType: 'REQUEST_AID',
            referenceId: 13,
          }),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      requestAid: {
        update: jest.fn().mockResolvedValue({
          id: 13,
          cost: new Prisma.Decimal(100),
          currentPayment: new Prisma.Decimal(100),
        }),
      },
      wallet: {
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    prisma.requestAid.findUnique.mockResolvedValue({
      beneficiary: { userId: 19 },
    });
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } },
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');
    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

    expect(tx.transaction.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.requestAid.update).toHaveBeenCalledTimes(1);
    expect(tx.requestAid.update).toHaveBeenCalledWith({
      where: { id: 13 },
      data: { currentPayment: { increment: new Prisma.Decimal(25) } },
      select: { id: true, cost: true, currentPayment: true },
    });
    expect(notificationsService.createAndSend).toHaveBeenCalledTimes(1);
  });

  it('marks sponsorship fund Stripe donations successful without side effects', async () => {
    const tx = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 88,
          donorId: 7,
          amount: new Prisma.Decimal(50),
          status: TransactionStatus.PENDING,
          type: TransactionType.GENERAL_DONATION,
          referenceType: null,
          referenceId: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      requestAid: {
        update: jest.fn(),
      },
      wallet: {
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_fund' } },
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 88,
        status: { not: TransactionStatus.SUCCESSFUL },
      },
      data: { status: TransactionStatus.SUCCESSFUL },
    });
    expect(tx.requestAid.update).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it.each(['payment_intent.payment_failed', 'payment_intent.canceled'])(
    'maps %s to FAILED unless the transaction is already successful',
    async (eventType) => {
      stripe.webhooks.constructEvent.mockReturnValue({
        type: eventType,
        data: { object: { id: 'pi_failed' } },
      });
      prisma.transaction.updateMany.mockResolvedValue({ count: 1 });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          stripePaymentIntentId: 'pi_failed',
          status: { not: TransactionStatus.SUCCESSFUL },
        },
        data: { status: TransactionStatus.FAILED },
      });
    },
  );

  it('creates a CREDIT wallet transaction when a wallet top-up succeeds', async () => {
    const tx = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 77,
          donorId: 7,
          amount: new Prisma.Decimal(50),
          status: TransactionStatus.PENDING,
          type: TransactionType.WALLET_TOP_UP,
          referenceType: 'WALLET',
          referenceId: 9,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      requestAid: {
        update: jest.fn(),
      },
      wallet: {
        update: jest.fn().mockResolvedValue({
          id: 9,
          runningBalance: new Prisma.Decimal(150),
        }),
      },
      walletTransaction: {
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_topup' } },
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 77,
        status: { not: TransactionStatus.SUCCESSFUL },
      },
      data: { status: TransactionStatus.SUCCESSFUL },
    });
    expect(tx.requestAid.update).not.toHaveBeenCalled();
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        runningBalance: { increment: new Prisma.Decimal(50) },
      },
      select: {
        id: true,
        runningBalance: true,
      },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        walletId: 9,
        transactionId: 77,
        amount: new Prisma.Decimal(50),
        type: TransactionType.WALLET_TOP_UP,
        direction: WalletTransactionDirection.CREDIT,
        referenceType: 'WALLET',
        referenceId: 9,
        balanceAfter: new Prisma.Decimal(150),
      },
    });
  });

  it('does not credit the wallet twice for repeated succeeded webhooks', async () => {
    const tx = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 77,
          donorId: 7,
          amount: new Prisma.Decimal(50),
          status: TransactionStatus.PENDING,
          type: TransactionType.WALLET_TOP_UP,
          referenceType: 'WALLET',
          referenceId: 9,
        }),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      requestAid: {
        update: jest.fn(),
      },
      wallet: {
        update: jest.fn().mockResolvedValue({
          id: 9,
          runningBalance: new Prisma.Decimal(150),
        }),
      },
      walletTransaction: {
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_topup' } },
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');
    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('rejects webhook payloads with invalid signatures', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'sig'),
    ).rejects.toThrow(BadRequestException);
  });
});
