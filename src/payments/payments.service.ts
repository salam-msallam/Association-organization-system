import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  UserType,
} from '@prisma/client';
import Stripe from 'stripe';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAidRequestPaymentIntentDto } from './dto/create-aid-request-payment-intent.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';

const REQUEST_AID_REFERENCE_TYPE = 'REQUEST_AID';
const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2026-06-24.dahlia';

type PaymentUserPayload = {
  id?: number;
  type?: string;
  userType?: string;
};

@Injectable()
export class PaymentsService {
  private stripe?: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async createAidRequestPaymentIntent(
    requestId: number,
    dto: CreateAidRequestPaymentIntentDto,
    user: PaymentUserPayload,
    lang = 'ar',
  ): Promise<PaymentIntentResponseDto> {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);
    const amount = this.parseDonationAmount(dto.amount, lang);

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
      throw new ForbiddenException(this.t('AUTHENTICATED_USER_NOT_DONOR', lang));
    }

    const aidRequest = await this.prisma.requestAid.findFirst({
      where: { id: requestId, status: Status.ACCEPTED },
      select: { id: true, cost: true, currentPayment: true },
    });

    if (!aidRequest) {
      throw new NotFoundException(this.t('ACCEPTED_AID_REQUEST_NOT_FOUND', lang));
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

    const stripe = this.getStripe(lang);
    const currency = this.getCurrency(lang);
    const stripeCustomerId = await this.getOrCreateStripeCustomerId(
      donor,
      stripe,
    );

    const transaction = await this.prisma.transaction.create({
      data: {
        donorId: donor.userId,
        amount,
        paymentStatus: TransactionStatus.PENDING,
        type: TransactionType.DIRECT_DONATION,
        referenceType: REQUEST_AID_REFERENCE_TYPE,
        referenceId: requestId,
      },
      select: { id: true, amount: true },
    });

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: this.toStripeMinorUnits(amount, lang),
        currency,
        customer: stripeCustomerId,
        metadata: {
          transactionId: String(transaction.id),
          donorId: String(donor.userId),
          requestId: String(requestId),
        },
      },
      {
        idempotencyKey: `payment-intent:${transaction.id}`,
      },
    );

    if (!paymentIntent.client_secret) {
      throw new InternalServerErrorException(
        this.t('STRIPE_CLIENT_SECRET_MISSING', lang),
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
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      default:
        break;
    }

    return { received: true };
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
      throw new ForbiddenException(this.t('ONLY_DONORS_CAN_CREATE_PAYMENTS', lang));
    }

    return user.id;
  }

  private parseDonationAmount(amount: number, lang: string): Prisma.Decimal {
    if (!Number.isFinite(amount)) {
      throw new BadRequestException(this.t('DONATION_AMOUNT_VALID_NUMBER', lang));
    }

    const amountText = String(amount);

    if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
      throw new BadRequestException(
        this.t('DONATION_AMOUNT_MAX_TWO_DECIMALS', lang),
      );
    }

    const decimalAmount = new Prisma.Decimal(amountText);

    if (decimalAmount.lte(0)) {
      throw new BadRequestException(this.t('DONATION_AMOUNT_POSITIVE', lang));
    }

    return decimalAmount;
  }

  private getStripe(lang: string): Stripe {
    if (this.stripe) return this.stripe;

    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY')?.trim();

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
    donor: {
      userId: number;
      stripeCustomerId: string | null;
      user: {
        firstName: string;
        lastName: string;
        email: string;
        countryCode: string;
        number: string;
      };
    },
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
      throw new BadRequestException(this.t('DONATION_AMOUNT_INVALID_FOR_STRIPE', lang));
    }

    const value = minorUnits.toNumber();

    if (!Number.isSafeInteger(value)) {
      throw new BadRequestException(this.t('DONATION_AMOUNT_TOO_LARGE', lang));
    }

    return value;
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id },
        select: {
          id: true,
          amount: true,
          paymentStatus: true,
          referenceType: true,
          referenceId: true,
        },
      });

      if (!transaction || transaction.paymentStatus === TransactionStatus.SUCCESSFUL) {
        return;
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { paymentStatus: TransactionStatus.SUCCESSFUL },
      });

      if (
        transaction.referenceType === REQUEST_AID_REFERENCE_TYPE &&
        transaction.referenceId
      ) {
        await tx.requestAid.update({
          where: { id: transaction.referenceId },
          data: { currentPayment: { increment: transaction.amount } },
        });
      }
    });
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    await this.prisma.transaction.updateMany({
      where: {
        stripePaymentIntentId: paymentIntent.id,
        paymentStatus: { not: TransactionStatus.SUCCESSFUL },
      },
      data: { paymentStatus: TransactionStatus.FAILED },
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
