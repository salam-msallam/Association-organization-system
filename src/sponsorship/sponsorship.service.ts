import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Status, UserType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';

const MONTHLY_SPONSORSHIP_AMOUNT = new Prisma.Decimal(10);
const MINIMUM_COVERAGE_MONTHS = 3;
const REQUIRED_BALANCE_PER_SPONSORSHIP = MONTHLY_SPONSORSHIP_AMOUNT.times(
  MINIMUM_COVERAGE_MONTHS,
);

type SponsorshipUserPayload = {
  id?: number;
  type?: string;
  userType?: string;
};

@Injectable()
export class SponsorshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async createRequest(user: SponsorshipUserPayload, lang = 'ar') {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM Wallet
        WHERE donorId = ${donorUserId}
        FOR UPDATE
      `;

      const wallet = await tx.wallet.findUnique({
        where: { donorId: donorUserId },
        select: { runningBalance: true },
      });
      const walletBalance = new Prisma.Decimal(wallet?.runningBalance ?? 0);

      const coveredSponsorshipCount = await tx.sponsorship.count({
        where: {
          donorId: donorUserId,
          status: { in: [Status.PENDING, Status.ACCEPTED] },
        },
      });
      const requiredWalletBalance = REQUIRED_BALANCE_PER_SPONSORSHIP.times(
        coveredSponsorshipCount + 1,
      );

      if (walletBalance.lt(requiredWalletBalance)) {
        throw new BadRequestException(
          this.t('INSUFFICIENT_WALLET_BALANCE', lang, {
            walletBalance: walletBalance.toFixed(2),
            requiredBalance: requiredWalletBalance.toFixed(2),
          }),
        );
      }

      const sponsorship = await tx.sponsorship.create({
        data: {
          donorId: donorUserId,
          amount: MONTHLY_SPONSORSHIP_AMOUNT,
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

      return {
        success: true,
        message: this.t('REQUEST_CREATED', lang),
        data: {
          id: sponsorship.id,
          donorId: sponsorship.donorId,
          monthlyAmount: sponsorship.amount.toFixed(2),
          status: sponsorship.status,
          orphanId: sponsorship.orphanId,
          employeeId: sponsorship.employeeId,
          requiredWalletBalance: requiredWalletBalance.toFixed(2),
          walletBalance: walletBalance.toFixed(2),
          createdAt: sponsorship.createdAt,
        },
      };
    });
  }

  async findMine(user: SponsorshipUserPayload, status?: string, lang = 'ar') {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);
    const normalizedStatus = this.normalizeStatus(status, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    const sponsorships = await this.prisma.sponsorship.findMany({
      where: {
        donorId: donorUserId,
        ...(normalizedStatus && { status: normalizedStatus }),
      },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        donorId: true,
        amount: true,
        status: true,
        rejectionReason: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        orphan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthOfDate: true,
            gender: true,
            class: true,
            talent: true,
          },
        },
      },
    });

    return {
      success: true,
      message: this.t('FETCH_SUCCESS', lang),
      data: sponsorships.map((sponsorship) => ({
        id: sponsorship.id,
        donorId: sponsorship.donorId,
        monthlyAmount: sponsorship.amount.toFixed(2),
        status: sponsorship.status,
        rejectionReason: this.localizeJsonValue(
          sponsorship.rejectionReason,
          lang,
        ),
        startDate: sponsorship.startDate,
        endDate: sponsorship.endDate,
        createdAt: sponsorship.createdAt,
        orphan: sponsorship.orphan
          ? {
              ...sponsorship.orphan,
              class: this.localizeJsonValue(sponsorship.orphan.class, lang),
              talent: this.localizeJsonValue(sponsorship.orphan.talent, lang),
            }
          : null,
      })),
    };
  }

  private getAuthenticatedDonorUserId(
    user: SponsorshipUserPayload,
    lang: string,
  ): number {
    if (!user?.id) {
      throw new UnauthorizedException(this.t('AUTHENTICATION_REQUIRED', lang));
    }

    const userType = user.type ?? user.userType;
    if (userType !== UserType.DONOR) {
      throw new ForbiddenException(this.t('ONLY_DONORS_CAN_APPLY', lang));
    }

    return user.id;
  }

  private normalizeStatus(
    status: string | undefined,
    lang: string,
  ): Status | undefined {
    if (!status) return undefined;

    const normalizedStatus = status.toUpperCase() as Status;
    if (!Object.values(Status).includes(normalizedStatus)) {
      throw new BadRequestException(this.t('INVALID_STATUS', lang));
    }

    return normalizedStatus;
  }

  private localizeJsonValue(value: unknown, lang: string): unknown {
    if (!value || typeof value !== 'object') return value ?? null;

    if (!Array.isArray(value) && ('ar' in value || 'en' in value)) {
      const bilingualValue = value as Record<string, unknown>;
      return bilingualValue[lang] ?? bilingualValue.ar ?? bilingualValue.en;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.localizeJsonValue(item, lang));
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        this.localizeJsonValue(item, lang),
      ]),
    );
  }

  private t(
    key: string,
    lang: string,
    args?: Record<string, string | number>,
  ): string {
    return this.i18n.t(`sponsorship.${key}`, { lang, args });
  }
}
