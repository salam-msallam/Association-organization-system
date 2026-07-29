import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsController } from './payments.controller';
import { WalletController } from './wallet.controller';

describe('PaymentsController', () => {
  let paymentsService: any;
  let controller: PaymentsController;

  beforeEach(() => {
    paymentsService = {
      createAidRequestPaymentIntent: jest.fn(),
      createWalletTopUpPaymentIntent: jest.fn(),
      donateWalletToAidRequest: jest.fn(),
      handleStripeWebhook: jest.fn(),
    };
    controller = new PaymentsController(paymentsService);
  });

  it('uses the payments route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PaymentsController)).toBe(
      'payments',
    );
  });

  it('protects payment intent creation with JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PaymentsController.prototype.createAidRequestPaymentIntent,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('does not protect the Stripe webhook route with guards', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PaymentsController.prototype.handleStripeWebhook,
      ),
    ).toBeUndefined();
  });

  it('passes the donor JWT payload to the service', async () => {
    paymentsService.createAidRequestPaymentIntent.mockResolvedValue({
      transactionId: 55,
      clientSecret: 'pi_123_secret_abc',
      amount: '25.00',
      currency: 'usd',
    });

    const req = { user: { id: 7, type: 'DONOR' } } as any;

    await controller.createAidRequestPaymentIntent(13, { amount: 25 }, req, 'en');

    expect(paymentsService.createAidRequestPaymentIntent).toHaveBeenCalledWith(
      13,
      { amount: 25 },
      req.user,
      'en',
    );
  });

  it('passes raw body and Stripe signature to the webhook service', async () => {
    paymentsService.handleStripeWebhook.mockResolvedValue({ received: true });
    const rawBody = Buffer.from('{}');

    await controller.handleStripeWebhook({ rawBody } as any, 'sig', 'ar');

    expect(paymentsService.handleStripeWebhook).toHaveBeenCalledWith(
      rawBody,
      'sig',
      'ar',
    );
  });
});

describe('WalletController', () => {
  let paymentsService: any;
  let controller: WalletController;

  beforeEach(() => {
    paymentsService = {
      createWalletTopUpPaymentIntent: jest.fn(),
      donateWalletToAidRequest: jest.fn(),
    };
    controller = new WalletController(paymentsService);
  });

  it('uses the wallet route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, WalletController)).toBe('wallet');
  });

  it('protects wallet top-up payment intent creation with JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        WalletController.prototype.createWalletTopUpPaymentIntent,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('passes the donor JWT payload to the service', async () => {
    paymentsService.createWalletTopUpPaymentIntent.mockResolvedValue({
      transactionId: 77,
      clientSecret: 'pi_topup_secret_abc',
      amount: '50.00',
      currency: 'usd',
    });

    const req = { user: { id: 7, type: 'DONOR' } } as any;
    const dto = { amount: '50.00' };

    await controller.createWalletTopUpPaymentIntent(dto, req, 'en');

    expect(paymentsService.createWalletTopUpPaymentIntent).toHaveBeenCalledWith(
      dto,
      req.user,
      'en',
    );
  });

  it('protects wallet aid request donations with JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        WalletController.prototype.donateWalletToAidRequest,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('passes request ID, amount, and donor JWT payload to the wallet donation service', async () => {
    paymentsService.donateWalletToAidRequest.mockResolvedValue({
      walletTransactionId: 101,
      donatedAmount: '25.00',
      balanceAfter: '75.00',
      requestId: 13,
      currentPayment: '65.00',
      remainingAmount: '35.00',
      compliancePercentage: '65.00',
    });

    const req = { user: { id: 7, type: 'DONOR' } } as any;
    const dto = { amount: '25.00' };

    await controller.donateWalletToAidRequest(13, dto, req, 'en');

    expect(paymentsService.donateWalletToAidRequest).toHaveBeenCalledWith(
      13,
      dto,
      req.user,
      'en',
    );
    expect(dto).not.toHaveProperty('donorId');
  });
});
