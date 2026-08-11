import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsController } from './payments.controller';
import { SponsorshipFundController } from './sponsorship-fund.controller';
import { WalletController } from './wallet.controller';

describe('PaymentsController', () => {
  let paymentsService: any;
  let controller: PaymentsController;

  beforeEach(() => {
    paymentsService = {
      createAidRequestPaymentIntent: jest.fn(),
      createWalletTopUpPaymentIntent: jest.fn(),
      donateWalletToAidRequest: jest.fn(),
      donateWalletToSponsorship: jest.fn(),
      getWalletBalance: jest.fn(),
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

    await controller.createAidRequestPaymentIntent(
      13,
      { amount: 25 },
      req,
      'en',
    );

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
      donateWalletToSponsorship: jest.fn(),
      getWalletBalance: jest.fn(),
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

  it('protects wallet balance retrieval with JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        WalletController.prototype.getWalletBalance,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('passes the donor JWT payload when retrieving wallet balance', async () => {
    paymentsService.getWalletBalance.mockResolvedValue({
      success: true,
      data: { balance: '250.00', currency: 'USD' },
    });

    const req = { user: { id: 7, type: 'DONOR' } } as any;

    await controller.getWalletBalance(req, 'en');

    expect(paymentsService.getWalletBalance).toHaveBeenCalledWith(
      req.user,
      'en',
    );
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

  it('passes sponsorship ID and donor JWT payload without a request body', async () => {
    paymentsService.donateWalletToSponsorship.mockResolvedValue({
      success: true,
    });
    const req = { user: { id: 7, type: 'DONOR' } } as any;

    await controller.donateWalletToSponsorship(5, req, 'ar');

    expect(paymentsService.donateWalletToSponsorship).toHaveBeenCalledWith(
      5,
      req.user,
      'ar',
    );
  });
});

describe('SponsorshipFundController', () => {
  let paymentsService: any;
  let controller: SponsorshipFundController;

  beforeEach(() => {
    paymentsService = {
      createSponsorshipFundPaymentIntent: jest.fn(),
      donateWalletToSponsorshipFund: jest.fn(),
    };
    controller = new SponsorshipFundController(paymentsService);
  });

  it('uses the requested sponsorship fund route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SponsorshipFundController)).toBe(
      'api/donor/sponsorship-fund',
    );
  });

  it('protects sponsorship fund Stripe payment intent creation with JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        SponsorshipFundController.prototype.createPaymentIntent,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('protects sponsorship fund wallet donations with JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        SponsorshipFundController.prototype.donateFromWallet,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('passes amount, donor JWT payload, and language for Stripe fund donations', async () => {
    paymentsService.createSponsorshipFundPaymentIntent.mockResolvedValue({
      transactionId: 88,
      clientSecret: 'pi_fund_secret_abc',
      amount: '50.00',
      currency: 'usd',
    });

    const req = { user: { id: 7, type: 'DONOR' } } as any;
    const dto = { amount: 50 };

    await controller.createPaymentIntent(dto, req, 'en');

    expect(
      paymentsService.createSponsorshipFundPaymentIntent,
    ).toHaveBeenCalledWith(dto, req.user, 'en');
  });

  it('passes amount, donor JWT payload, and language for wallet fund donations', async () => {
    paymentsService.donateWalletToSponsorshipFund.mockResolvedValue({
      success: true,
      data: {
        walletTransactionId: 130,
        donatedAmount: '50.00',
        balanceAfter: '50.00',
        currency: 'USD',
      },
    });

    const req = { user: { id: 7, type: 'DONOR' } } as any;
    const dto = { amount: '50.00' };

    await controller.donateFromWallet(dto, req, 'ar');

    expect(paymentsService.donateWalletToSponsorshipFund).toHaveBeenCalledWith(
      dto,
      req.user,
      'ar',
    );
  });
});
