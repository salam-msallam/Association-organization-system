import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import Stripe from 'stripe';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { getSponsorshipPaymentContext } from '../sponsorship/sponsorship-billing-period';
import { CreateAidRequestPaymentIntentDto } from './dto/create-aid-request-payment-intent.dto';
import { CreateSponsorshipFundPaymentIntentDto } from './dto/create-sponsorship-fund-payment-intent.dto';
import { CreateWalletTopUpPaymentIntentDto } from './dto/create-wallet-top-up-payment-intent.dto';
import { DonateWalletToSponsorshipFundDto } from './dto/donate-wallet-to-sponsorship-fund.dto';
import { DonateWalletToAidRequestDto } from './dto/donate-wallet-to-aid-request.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { WalletBalanceResponseDto } from './dto/wallet-balance-response.dto';
import { WalletAidRequestDonationResponseDto } from './dto/wallet-aid-request-donation-response.dto';
import { WalletSponsorshipFundDonationResponseDto } from './dto/wallet-sponsorship-fund-donation-response.dto';
import { WalletSponsorshipDonationResponseDto } from './dto/wallet-sponsorship-donation-response.dto';

const REQUEST_AID_REFERENCE_TYPE = 'REQUEST_AID';
const WALLET_REFERENCE_TYPE = 'WALLET';
const SPONSORSHIP_REFERENCE_TYPE = 'SPONSORSHIP';
const WALLET_CURRENCY = 'USD';
const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2026-06-24.dahlia';
const BLOCKING_SPONSORSHIP_STATUSES = [Status.PENDING, Status.ACCEPTED];

type PaymentUserPayload = {
  id?: number;
  type?: string;
  userType?: string;
};

type DonorWithUser = {
  id: number;
  userId: number;
  stripeCustomerId: string | null;
  isSponsor: boolean;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    countryCode: string;
    number: string;
  };
};

type CreateStripeBackedTransactionInput = {
  donor: DonorWithUser;
  amount: Prisma.Decimal;
  type: TransactionType;
  referenceType?: string;
  referenceId?: number;
  metadata: Record<string, string>;
  lang: string;
};

type SponsorshipReader = {
  sponsorship: {
    findFirst(
      args: Prisma.SponsorshipFindFirstArgs,
    ): Promise<{ id: number } | null>;
  };
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe?: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createAidRequestPaymentIntent(
    requestId: number,
    dto: CreateAidRequestPaymentIntentDto,
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<PaymentIntentResponseDto> {
    const amount = this.parsePaymentAmount(dto.amount, lang);
    const donor = await this.getAuthenticatedDonor(user, lang);

    const aidRequest = await this.prisma.requestAid.findFirst({
      where: { id: requestId, status: Status.ACCEPTED },
      select: { id: true, cost: true, currentPayment: true },
    });

    if (!aidRequest) {
      throw new NotFoundException(
        this.t('ACCEPTED_AID_REQUEST_NOT_FOUND', lang),
      );
    }

    const remainingAmount = new Prisma.Decimal(aidRequest.cost).minus(
      aidRequest.currentPayment,
    );

    if (remainingAmount.lte(0)) {
      throw new BadRequestException(this.t('AID_REQUEST_FULLY_FUNDED', lang));
    }

    if (amount.gt(remainingAmount)) {
      throw new BadRequestException(
        this.t('DONATION_AMOUNT_EXCEEDS_REMAINING', lang, {
          remainingAmount: remainingAmount.toFixed(2),
        }),
      );
    }

    return this.createStripeBackedTransaction({
      donor,
      amount,
      type: TransactionType.AID_REQUEST_DONATION,
      referenceType: REQUEST_AID_REFERENCE_TYPE,
      referenceId: requestId,
      metadata: {
        requestId: String(requestId),
      },
      lang,
    });
  }

  async createWalletTopUpPaymentIntent(
    dto: CreateWalletTopUpPaymentIntentDto,
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<PaymentIntentResponseDto> {
    const amount = this.parsePaymentAmount(dto.amount, lang);
    const donor = await this.getAuthenticatedDonor(user, lang);

    const wallet = await this.prisma.wallet.upsert({
      where: { donorId: donor.userId },
      create: {
        donorId: donor.userId,
        runningBalance: new Prisma.Decimal(0),
      },
      update: {},
      select: { id: true },
    });

    return this.createStripeBackedTransaction({
      donor,
      amount,
      type: TransactionType.WALLET_TOP_UP,
      referenceType: WALLET_REFERENCE_TYPE,
      referenceId: wallet.id,
      metadata: {
        walletId: String(wallet.id),
        type: TransactionType.WALLET_TOP_UP,
      },
      lang,
    });
  }

  async createSponsorshipFundPaymentIntent(
    dto: CreateSponsorshipFundPaymentIntentDto,
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<PaymentIntentResponseDto> {
    const amount = this.parsePaymentAmount(dto.amount, lang);
    const donor = await this.getAuthenticatedDonor(user, lang);

    return this.createStripeBackedTransaction({
      donor,
      amount,
      type: TransactionType.GENERAL_DONATION,
      metadata: {
        type: TransactionType.GENERAL_DONATION,
      },
      lang,
    });
  }

  async getWalletBalance(
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<WalletBalanceResponseDto> {
    const donor = await this.getAuthenticatedDonor(user, lang);

    const wallet = await this.prisma.wallet.upsert({
      where: { donorId: donor.userId },
      create: {
        donorId: donor.userId,
        runningBalance: new Prisma.Decimal(0),
      },
      update: {},
      select: { runningBalance: true },
    });

    return {
      success: true,
      data: {
        balance: new Prisma.Decimal(wallet.runningBalance).toFixed(2),
        currency: WALLET_CURRENCY,
      },
    };
  }

  async donateWalletToAidRequest(
    requestId: number,
    dto: DonateWalletToAidRequestDto,
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<WalletAidRequestDonationResponseDto> {
    const amount = this.parsePaymentAmount(dto.amount, lang, {
      requireExactlyTwoDecimals: true,
    });
    const donor = await this.getAuthenticatedDonor(user, lang);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertNoBlockingSponsorship(tx, donor.id, lang);

      const aidRequest = await tx.requestAid.findFirst({
        where: { id: requestId, status: Status.ACCEPTED },
        select: { id: true, cost: true, currentPayment: true },
      });

      if (!aidRequest) {
        throw new NotFoundException(
          this.t('ACCEPTED_AID_REQUEST_NOT_FOUND', lang),
        );
      }

      const cost = new Prisma.Decimal(aidRequest.cost);
      const remainingAmount = cost.minus(aidRequest.currentPayment);

      if (remainingAmount.lte(0)) {
        throw new BadRequestException(this.t('AID_REQUEST_FULLY_FUNDED', lang));
      }

      if (amount.gt(remainingAmount)) {
        throw new BadRequestException(
          this.t('DONATION_AMOUNT_EXCEEDS_REMAINING', lang, {
            remainingAmount: remainingAmount.toFixed(2),
          }),
        );
      }

      const wallet = await tx.wallet.findUnique({
        where: { donorId: donor.userId },
        select: { id: true, runningBalance: true },
      });

      if (!wallet) {
        throw new NotFoundException(this.t('WALLET_NOT_FOUND', lang));
      }

      if (new Prisma.Decimal(wallet.runningBalance).lt(amount)) {
        throw new BadRequestException(
          this.t('INSUFFICIENT_WALLET_BALANCE', lang),
        );
      }

      const walletUpdate = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          runningBalance: { gte: amount },
        },
        data: {
          runningBalance: { decrement: amount },
        },
      });

      if (walletUpdate.count === 0) {
        throw new BadRequestException(
          this.t('INSUFFICIENT_WALLET_BALANCE', lang),
        );
      }

      const aidRequestUpdate = await tx.requestAid.updateMany({
        where: {
          id: aidRequest.id,
          status: Status.ACCEPTED,
          currentPayment: { lte: cost.minus(amount) },
        },
        data: {
          currentPayment: { increment: amount },
        },
      });

      if (aidRequestUpdate.count === 0) {
        throw new BadRequestException(
          this.t('WALLET_DONATION_CONCURRENT_UPDATE', lang),
        );
      }

      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
        select: { id: true, runningBalance: true },
      });
      const updatedAidRequest = await tx.requestAid.findUnique({
        where: { id: aidRequest.id },
        select: { id: true, cost: true, currentPayment: true },
      });

      if (!updatedWallet || !updatedAidRequest) {
        throw new BadRequestException(
          this.t('WALLET_DONATION_CONCURRENT_UPDATE', lang),
        );
      }

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: updatedWallet.id,
          transactionId: null,
          amount,
          type: TransactionType.AID_REQUEST_DONATION,
          direction: WalletTransactionDirection.DEBIT,
          referenceType: REQUEST_AID_REFERENCE_TYPE,
          referenceId: requestId,
          balanceAfter: updatedWallet.runningBalance,
        },
        select: { id: true },
      });

      const currentPayment = new Prisma.Decimal(
        updatedAidRequest.currentPayment,
      );
      const updatedCost = new Prisma.Decimal(updatedAidRequest.cost);
      const updatedRemainingAmount = updatedCost.minus(currentPayment);

      return {
        walletTransactionId: walletTransaction.id,
        donatedAmount: amount.toFixed(2),
        balanceAfter: new Prisma.Decimal(updatedWallet.runningBalance).toFixed(
          2,
        ),
        requestId,
        currentPayment: currentPayment.toFixed(2),
        remainingAmount: updatedRemainingAmount.toFixed(2),
        compliancePercentage: currentPayment
          .times(100)
          .div(updatedCost)
          .toFixed(2),
      };
    });

    if (new Prisma.Decimal(result.remainingAmount).lte(0)) {
      await this.notifyAidRequestFullyFunded(requestId);
    }

    return result;
  }

  async donateWalletToSponsorship(
    sponsorshipId: number,
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<WalletSponsorshipDonationResponseDto> {
    const donor = await this.getAuthenticatedDonor(user, lang);
    const now = new Date();
    const paymentContext = getSponsorshipPaymentContext(now);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM Sponsorship
        WHERE id = ${sponsorshipId}
        FOR UPDATE
      `;

      const sponsorship = await tx.sponsorship.findFirst({
        where: {
          id: sponsorshipId,
          donorId: donor.id,
          status: Status.ACCEPTED,
        },
        select: { id: true, amount: true },
      });

      if (!sponsorship) {
        throw new NotFoundException(this.t('SPONSORSHIP_NOT_FOUND', lang));
      }

      const anyPreviousPayment = await tx.walletTransaction.findFirst({
        where: {
          type: TransactionType.SPONSORSHIP_DONATION,
          direction: WalletTransactionDirection.DEBIT,
          referenceType: SPONSORSHIP_REFERENCE_TYPE,
          referenceId: sponsorship.id,
        },
        select: { id: true },
      });

      if (anyPreviousPayment && !paymentContext.isRenewalWindowOpen) {
        throw new BadRequestException(
          this.t('SPONSORSHIP_RENEWAL_NOT_OPEN', lang),
        );
      }

      if (paymentContext.isRenewalWindowOpen) {
        const paymentInCurrentWindow = await tx.walletTransaction.findFirst({
          where: {
            type: TransactionType.SPONSORSHIP_DONATION,
            direction: WalletTransactionDirection.DEBIT,
            referenceType: SPONSORSHIP_REFERENCE_TYPE,
            referenceId: sponsorship.id,
            createdAt: {
              gte: paymentContext.renewalWindowStart,
              lt: paymentContext.renewalWindowEnd,
            },
          },
          select: { id: true },
        });

        if (paymentInCurrentWindow) {
          throw new BadRequestException(
            this.t('SPONSORSHIP_ALREADY_PAID', lang),
          );
        }
      }

      const amount = new Prisma.Decimal(sponsorship.amount);
      const wallet = await tx.wallet.findUnique({
        where: { donorId: donor.userId },
        select: { id: true, runningBalance: true },
      });

      if (!wallet) {
        throw new NotFoundException(this.t('WALLET_NOT_FOUND', lang));
      }

      if (new Prisma.Decimal(wallet.runningBalance).lt(amount)) {
        throw new BadRequestException(
          this.t('INSUFFICIENT_WALLET_BALANCE', lang),
        );
      }

      const walletUpdate = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          runningBalance: { gte: amount },
        },
        data: { runningBalance: { decrement: amount } },
      });

      if (walletUpdate.count !== 1) {
        throw new BadRequestException(
          this.t('SPONSORSHIP_PAYMENT_CONCURRENT_UPDATE', lang),
        );
      }

      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
        select: { runningBalance: true },
      });

      if (!updatedWallet) {
        throw new BadRequestException(
          this.t('SPONSORSHIP_PAYMENT_CONCURRENT_UPDATE', lang),
        );
      }

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionId: null,
          amount,
          type: TransactionType.SPONSORSHIP_DONATION,
          direction: WalletTransactionDirection.DEBIT,
          referenceType: SPONSORSHIP_REFERENCE_TYPE,
          referenceId: sponsorship.id,
          balanceAfter: updatedWallet.runningBalance,
          createdAt: now,
        },
        select: { id: true, createdAt: true },
      });

      return {
        success: true,
        message: this.t('SPONSORSHIP_PAYMENT_SUCCESS', lang),
        data: {
          walletTransactionId: walletTransaction.id,
          sponsorshipId: sponsorship.id,
          paidAmount: amount.toFixed(2),
          balanceAfter: new Prisma.Decimal(
            updatedWallet.runningBalance,
          ).toFixed(2),
          coveredMonth: paymentContext.coveredMonth,
          paidAt: walletTransaction.createdAt,
        },
      };
    });

    await this.notifySponsorshipPaymentSucceeded(
      donor.userId,
      result.data.walletTransactionId,
      result.data.sponsorshipId,
      result.data.coveredMonth,
      result.data.paidAmount,
    );

    return result;
  }

  async donateWalletToSponsorshipFund(
    dto: DonateWalletToSponsorshipFundDto,
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<WalletSponsorshipFundDonationResponseDto> {
    const amount = this.parsePaymentAmount(dto.amount, lang, {
      requireExactlyTwoDecimals: true,
    });
    const donor = await this.getAuthenticatedDonor(user, lang);

    if (donor.isSponsor) {
      throw new ForbiddenException(
        this.t('SPONSORS_CANNOT_DONATE_WALLET_TO_FUND', lang),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { donorId: donor.userId },
        select: { id: true, runningBalance: true },
      });

      if (!wallet) {
        throw new NotFoundException(this.t('WALLET_NOT_FOUND', lang));
      }

      if (new Prisma.Decimal(wallet.runningBalance).lt(amount)) {
        throw new BadRequestException(
          this.t('INSUFFICIENT_WALLET_BALANCE', lang),
        );
      }

      const walletUpdate = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          runningBalance: { gte: amount },
        },
        data: { runningBalance: { decrement: amount } },
      });

      if (walletUpdate.count !== 1) {
        throw new BadRequestException(
          this.t('WALLET_FUND_DONATION_CONCURRENT_UPDATE', lang),
        );
      }

      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
        select: { runningBalance: true },
      });

      if (!updatedWallet) {
        throw new BadRequestException(
          this.t('WALLET_FUND_DONATION_CONCURRENT_UPDATE', lang),
        );
      }

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionId: null,
          amount,
          type: TransactionType.GENERAL_DONATION,
          direction: WalletTransactionDirection.DEBIT,
          referenceType: null,
          referenceId: null,
          balanceAfter: updatedWallet.runningBalance,
        },
        select: { id: true },
      });

      return {
        success: true,
        message: this.t('SPONSORSHIP_FUND_DONATION_SUCCESS', lang),
        data: {
          walletTransactionId: walletTransaction.id,
          donatedAmount: amount.toFixed(2),
          balanceAfter: new Prisma.Decimal(
            updatedWallet.runningBalance,
          ).toFixed(2),
          currency: WALLET_CURRENCY,
        },
      };
    });
  }

  async handleStripeWebhook(
    rawBody: Buffer | undefined,
    signature: string | string[] | undefined,
    lang = 'ar',
  ): Promise<{ received: true }> {
    const stripeSignature = Array.isArray(signature) ? signature[0] : signature;

    if (!rawBody || !stripeSignature) {
      throw new BadRequestException(
        this.t('WEBHOOK_SIGNATURE_OR_BODY_MISSING', lang),
      );
    }

    const webhookSecret = this.configService
      .get<string>('STRIPE_WEBHOOK_SECRET')
      ?.trim();

    if (!webhookSecret) {
      throw new InternalServerErrorException(
        this.t('STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED', lang),
      );
    }

    let event: Stripe.Event;

    try {
      event = this.getStripe(lang).webhooks.constructEvent(
        rawBody,
        stripeSignature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException(this.t('INVALID_WEBHOOK_SIGNATURE', lang));
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await this.handlePaymentIntentFailed(event.data.object);
        break;
      default:
        break;
    }

    return { received: true };
  }

  private async getAuthenticatedDonor(
    user: PaymentUserPayload,
    lang: string,
  ): Promise<DonorWithUser> {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            countryCode: true,
            number: true,
          },
        },
      },
    });

    if (!donor) {
      throw new ForbiddenException(
        this.t('AUTHENTICATED_USER_NOT_DONOR', lang),
      );
    }

    return donor;
  }

  private getAuthenticatedDonorUserId(
    user: PaymentUserPayload,
    lang: string,
  ): number {
    if (!user?.id) {
      throw new UnauthorizedException(this.t('AUTHENTICATION_REQUIRED', lang));
    }

    const userType = user.type ?? user.userType;

    if (userType !== UserType.DONOR) {
      throw new ForbiddenException(
        this.t('ONLY_DONORS_CAN_CREATE_PAYMENTS', lang),
      );
    }

    return user.id;
  }

  private parsePaymentAmount(
    amount: number | string,
    lang: string,
    options: { requireExactlyTwoDecimals?: boolean } = {},
  ): Prisma.Decimal {
    if (typeof amount !== 'number' && typeof amount !== 'string') {
      throw new BadRequestException(
        this.t('PAYMENT_AMOUNT_VALID_NUMBER', lang),
      );
    }

    if (typeof amount === 'number' && !Number.isFinite(amount)) {
      throw new BadRequestException(
        this.t('PAYMENT_AMOUNT_VALID_NUMBER', lang),
      );
    }

    const amountText = String(amount).trim();
    const amountPattern = options.requireExactlyTwoDecimals
      ? /^\d+\.\d{2}$/
      : /^\d+(\.\d{1,2})?$/;

    if (!amountPattern.test(amountText)) {
      throw new BadRequestException(
        this.t(
          options.requireExactlyTwoDecimals
            ? 'PAYMENT_AMOUNT_EXACTLY_TWO_DECIMALS'
            : 'PAYMENT_AMOUNT_MAX_TWO_DECIMALS',
          lang,
        ),
      );
    }

    const decimalAmount = new Prisma.Decimal(amountText);

    if (decimalAmount.lte(0)) {
      throw new BadRequestException(this.t('PAYMENT_AMOUNT_POSITIVE', lang));
    }

    return decimalAmount;
  }

  private async assertNoBlockingSponsorship(
    prisma: SponsorshipReader,
    donorId: number,
    lang: string,
  ): Promise<void> {
    const sponsorship = await prisma.sponsorship.findFirst({
      where: {
        donorId,
        status: { in: BLOCKING_SPONSORSHIP_STATUSES },
      },
      select: { id: true },
    });

    if (sponsorship) {
      throw new ForbiddenException(
        this.t('WALLET_RESERVED_FOR_SPONSORSHIP', lang),
      );
    }
  }

  private async createStripeBackedTransaction(
    input: CreateStripeBackedTransactionInput,
  ): Promise<PaymentIntentResponseDto> {
    const stripe = this.getStripe(input.lang);
    const currency = this.getCurrency(input.lang);
    const stripeCustomerId = await this.getOrCreateStripeCustomerId(
      input.donor,
      stripe,
    );

    const transaction = await this.prisma.transaction.create({
      data: {
        donorId: input.donor.userId,
        idempotencyKey: `payment-intent:${randomUUID()}`,
        amount: input.amount,
        status: TransactionStatus.PENDING,
        type: input.type,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        currency,
      },
      select: { id: true, amount: true, idempotencyKey: true },
    });

    if (!transaction.idempotencyKey) {
      throw new InternalServerErrorException(
        this.t('STRIPE_IDEMPOTENCY_KEY_MISSING', input.lang),
      );
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: this.toStripeMinorUnits(input.amount, input.lang),
        currency,
        customer: stripeCustomerId,
        automatic_payment_methods: { enabled: true },
        metadata: {
          transactionId: String(transaction.id),
          donorId: String(input.donor.userId),
          ...input.metadata,
        },
      },
      {
        idempotencyKey: transaction.idempotencyKey,
      },
    );

    if (!paymentIntent.client_secret) {
      throw new InternalServerErrorException(
        this.t('STRIPE_CLIENT_SECRET_MISSING', input.lang),
      );
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return {
      transactionId: transaction.id,
      clientSecret: paymentIntent.client_secret,
      amount: new Prisma.Decimal(transaction.amount).toFixed(2),
      currency,
    };
  }

  private getStripe(lang: string): Stripe {
    if (this.stripe) return this.stripe;

    const secretKey = this.configService
      .get<string>('STRIPE_SECRET_KEY')
      ?.trim();

    if (!secretKey) {
      throw new InternalServerErrorException(
        this.t('STRIPE_SECRET_KEY_NOT_CONFIGURED', lang),
      );
    }

    this.stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
    return this.stripe;
  }

  private getCurrency(lang: string): string {
    const currency = this.configService.get<string>('STRIPE_CURRENCY')?.trim();

    if (!currency) {
      throw new InternalServerErrorException(
        this.t('STRIPE_CURRENCY_NOT_CONFIGURED', lang),
      );
    }

    return currency.toLowerCase();
  }

  private async getOrCreateStripeCustomerId(
    donor: DonorWithUser,
    stripe: Stripe,
  ): Promise<string> {
    if (donor.stripeCustomerId) return donor.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: donor.user.email,
      name: `${donor.user.firstName} ${donor.user.lastName}`.trim(),
      phone: `${donor.user.countryCode}${donor.user.number}`,
      metadata: {
        donorId: String(donor.userId),
        userId: String(donor.userId),
      },
    });

    await this.prisma.donor.update({
      where: { userId: donor.userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  private toStripeMinorUnits(amount: Prisma.Decimal, lang: string): number {
    const minorUnits = amount.times(100);

    if (!minorUnits.isInteger() || minorUnits.lte(0)) {
      throw new BadRequestException(
        this.t('PAYMENT_AMOUNT_INVALID_FOR_STRIPE', lang),
      );
    }

    const value = minorUnits.toNumber();

    if (!Number.isSafeInteger(value)) {
      throw new BadRequestException(this.t('PAYMENT_AMOUNT_TOO_LARGE', lang));
    }

    return value;
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const fullyFundedRequestId = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id },
        select: {
          id: true,
          donorId: true,
          amount: true,
          status: true,
          type: true,
          referenceType: true,
          referenceId: true,
        },
      });

      if (!transaction) {
        return null;
      }

      const updateResult = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { not: TransactionStatus.SUCCESSFUL },
        },
        data: { status: TransactionStatus.SUCCESSFUL },
      });

      if (updateResult.count === 0) {
        return null;
      }

      let completedAidRequestId: number | null = null;

      if (
        transaction.type === TransactionType.AID_REQUEST_DONATION &&
        transaction.referenceType === REQUEST_AID_REFERENCE_TYPE &&
        transaction.referenceId
      ) {
        const updatedAidRequest = await tx.requestAid.update({
          where: { id: transaction.referenceId },
          data: { currentPayment: { increment: transaction.amount } },
          select: { id: true, cost: true, currentPayment: true },
        });

        const cost = new Prisma.Decimal(updatedAidRequest.cost);
        const currentPayment = new Prisma.Decimal(
          updatedAidRequest.currentPayment,
        );
        const previousPayment = currentPayment.minus(transaction.amount);

        if (previousPayment.lt(cost) && currentPayment.gte(cost)) {
          completedAidRequestId = updatedAidRequest.id;
        }
      }

      if (
        transaction.type === TransactionType.WALLET_TOP_UP &&
        transaction.referenceType === WALLET_REFERENCE_TYPE &&
        transaction.referenceId
      ) {
        const wallet = await tx.wallet.update({
          where: { id: transaction.referenceId },
          data: {
            runningBalance: { increment: transaction.amount },
          },
          select: {
            id: true,
            runningBalance: true,
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionId: transaction.id,
            amount: transaction.amount,
            type: TransactionType.WALLET_TOP_UP,
            direction: WalletTransactionDirection.CREDIT,
            referenceType: WALLET_REFERENCE_TYPE,
            referenceId: wallet.id,
            balanceAfter: wallet.runningBalance,
          },
        });
      }

      return completedAidRequestId;
    });

    if (fullyFundedRequestId) {
      await this.notifyAidRequestFullyFunded(fullyFundedRequestId);
    }
  }

  private async notifyAidRequestFullyFunded(requestId: number): Promise<void> {
    try {
      const request = await this.prisma.requestAid.findUnique({
        where: { id: requestId },
        select: { beneficiary: { select: { userId: true } } },
      });

      if (!request) {
        this.logger.warn(
          `Cannot create the fully funded notification for missing aid request ${requestId}`,
        );
        return;
      }

      await this.notificationsService.createAndSend({
        userId: request.beneficiary.userId,
        title: {
          ar: 'تم تمويل طلب الإعانة بالكامل',
          en: 'Your assistance request has been fully funded',
        },
        message: {
          ar: 'اكتمل تمويل طلب الإعانة الخاص بك بالكامل.',
          en: 'Your assistance request has now received full funding.',
        },
        targetType: 'REQUEST_AID',
        targetId: requestId,
      });
    } catch {
      this.logger.warn(
        `Failed to create the fully funded notification for aid request ${requestId}`,
      );
    }
  }

  private async notifySponsorshipPaymentSucceeded(
    donorUserId: number,
    walletTransactionId: number,
    sponsorshipId: number,
    coveredMonth: string,
    paidAmount: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSend({
        userId: donorUserId,
        title: {
          ar: 'تم دفع دفعة الكفالة بنجاح',
          en: 'Sponsorship payment successful',
        },
        message: {
          ar: `تم تسجيل دفعة كفالتك لشهر ${coveredMonth} بقيمة ${paidAmount} دولار أمريكي بنجاح.`,
          en: `Your sponsorship payment of USD ${paidAmount} for ${coveredMonth} was recorded successfully.`,
        },
        targetType: 'SPONSORSHIP_PAYMENT',
        targetId: walletTransactionId,
        additionalData: {
          sponsorshipId: String(sponsorshipId),
          coveredMonth,
          paidAmount,
        },
      });
    } catch {
      this.logger.warn(
        `Failed to create the sponsorship payment notification for wallet transaction ${walletTransactionId}`,
      );
    }
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await this.prisma.transaction.updateMany({
      where: {
        stripePaymentIntentId: paymentIntent.id,
        status: { not: TransactionStatus.SUCCESSFUL },
      },
      data: { status: TransactionStatus.FAILED },
    });
  }

  private t(
    key: string,
    lang: string,
    args?: Record<string, string | number>,
  ): string {
    return this.i18n.t(`payments.${key}`, { lang, args });
  }
}
