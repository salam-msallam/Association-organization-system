import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  UserType,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let prisma: any;
  let configService: any;
  let i18n: any;
  let stripe: any;
  let service: PaymentsService;

  const donor = {
    userId: 7,
    stripeCustomerId: null,
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
      },
      transaction: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
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
    service = new PaymentsService(prisma, configService, i18n);
    (service as any).stripe = stripe;
  });

  function mockValidDonationSetup() {
    prisma.donor.findUnique.mockResolvedValue(donor);
    prisma.requestAid.findFirst.mockResolvedValue({
      id: 13,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(40),
    });
    stripe.customers.create.mockResolvedValue({ id: 'cus_123' });
    prisma.donor.update.mockResolvedValue({ ...donor, stripeCustomerId: 'cus_123' });
    prisma.transaction.create.mockResolvedValue({
      id: 55,
      amount: new Prisma.Decimal(25),
    });
    stripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret_abc',
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
        amount: new Prisma.Decimal(25),
        paymentStatus: TransactionStatus.PENDING,
        type: TransactionType.DIRECT_DONATION,
        referenceType: 'REQUEST_AID',
        referenceId: 13,
      },
      select: { id: true, amount: true },
    });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 2500,
        currency: 'usd',
        customer: 'cus_123',
        metadata: {
          transactionId: '55',
          donorId: '7',
          requestId: '13',
        },
      },
      { idempotencyKey: 'payment-intent:55' },
    );
    expect(
      prisma.transaction.create.mock.invocationCallOrder[0],
    ).toBeLessThan(stripe.paymentIntents.create.mock.invocationCallOrder[0]);
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

  it('increments aid request payment only once for repeated succeeded webhooks', async () => {
    const tx = {
      transaction: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 55,
            amount: new Prisma.Decimal(25),
            paymentStatus: TransactionStatus.PENDING,
            referenceType: 'REQUEST_AID',
            referenceId: 13,
          })
          .mockResolvedValueOnce({
            id: 55,
            amount: new Prisma.Decimal(25),
            paymentStatus: TransactionStatus.SUCCESSFUL,
            referenceType: 'REQUEST_AID',
            referenceId: 13,
          }),
        update: jest.fn(),
      },
      requestAid: {
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } },
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');
    await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

    expect(tx.transaction.update).toHaveBeenCalledTimes(1);
    expect(tx.requestAid.update).toHaveBeenCalledTimes(1);
    expect(tx.requestAid.update).toHaveBeenCalledWith({
      where: { id: 13 },
      data: { currentPayment: { increment: new Prisma.Decimal(25) } },
    });
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
          paymentStatus: { not: TransactionStatus.SUCCESSFUL },
        },
        data: { paymentStatus: TransactionStatus.FAILED },
      });
    },
  );

  it('rejects webhook payloads with invalid signatures', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'sig'),
    ).rejects.toThrow(BadRequestException);
  });
});
