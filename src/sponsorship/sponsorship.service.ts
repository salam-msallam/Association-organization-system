import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CancellationSource,
  Gender,
  OrphanEmergencyCoverageReason,
  Prisma,
  Status,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewSponsorshipDto } from './dto/review-sponsorship.dto';
import {
  getPreviousRenewalWindow,
  SPONSORSHIP_TIME_ZONE,
  toSponsorshipDatabaseDate,
} from './sponsorship-billing-period';
import { SponsorshipFundService } from './sponsorship-fund.service';

const MONTHLY_SPONSORSHIP_AMOUNT = new Prisma.Decimal(10);
const MINIMUM_COVERAGE_MONTHS = 3;
const REQUIRED_BALANCE_PER_SPONSORSHIP = MONTHLY_SPONSORSHIP_AMOUNT.times(
  MINIMUM_COVERAGE_MONTHS,
);
const SPONSORSHIP_REFERENCE_TYPE = 'SPONSORSHIP';

type SponsorshipUserPayload = {
  id?: number;
  type?: string;
  userType?: string;
};

type AdminSponsorshipOrphanSummary = {
  id: number;
  firstName: string;
  lastName: string;
};

type AdminSponsorshipOrphanDetails = AdminSponsorshipOrphanSummary & {
  fatherName: string;
  motherName: string;
  birthOfDate: Date;
  gender: Gender;
  class: Prisma.JsonValue;
  Diseases: Prisma.JsonValue;
  FamilyStatement: string;
  brotherAndSisterNumber: number;
  guardianName: string;
  guaranteedPhone: string;
  bodySize: number;
  shoesSize: number;
  currentAddress: Prisma.JsonValue;
  previousAddress: Prisma.JsonValue;
  talent: Prisma.JsonValue;
  isSupported: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AdminSponsorshipRecord<TOrphan> = {
  id: number;
  amount: Prisma.Decimal;
  status: Status;
  rejectionReason: Prisma.JsonValue | null;
  startDate: Date | null;
  endDate: Date | null;
  cancellationSource: CancellationSource | null;
  createdAt: Date;
  donor: {
    id: number;
    userId: number;
    user: {
      firstName: string;
      lastName: string;
      email: string;
      number: string;
    };
  };
  orphan: TOrphan;
};

@Injectable()
export class SponsorshipService {
  private readonly logger = new Logger(SponsorshipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly sponsorshipFundService: SponsorshipFundService,
  ) {}

  async createRequest(user: SponsorshipUserPayload, lang = 'ar') {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { id: true, userId: true },
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
          donorId: donor.id,
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
          donorId: donor.id,
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
      select: { id: true, userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    const sponsorships = await this.prisma.sponsorship.findMany({
      where: {
        donorId: donor.id,
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
        cancellationSource: true,
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
        cancellationSource: sponsorship.cancellationSource,
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

  async findAllForStaff(
    status?: string,
    lang = 'ar',
    pageInput?: string,
    limitInput?: string,
  ) {
    const normalizedStatus = this.normalizeStatus(status, lang);
    const page = this.parsePositiveInteger(pageInput, 1, lang);
    const limit = this.parsePositiveInteger(limitInput, 10, lang);
    const skip = (page - 1) * limit;
    const where: Prisma.SponsorshipWhereInput = normalizedStatus
      ? { status: normalizedStatus }
      : {};

    const [sponsorships, totalCount] = await Promise.all([
      this.prisma.sponsorship.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          rejectionReason: true,
          startDate: true,
          endDate: true,
          cancellationSource: true,
          createdAt: true,
          donor: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  number: true,
                },
              },
            },
          },
          orphan: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.sponsorship.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      message: this.t('ADMIN_FETCH_SUCCESS', lang),
      data: sponsorships.map((sponsorship) =>
        this.toAdminSponsorshipResponse(sponsorship, lang),
      ),
      meta: {
        totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOneForStaff(sponsorshipId: number, lang = 'ar') {
    const sponsorship = await this.prisma.sponsorship.findUnique({
      where: { id: sponsorshipId },
      select: {
        id: true,
        amount: true,
        status: true,
        rejectionReason: true,
        startDate: true,
        endDate: true,
        cancellationSource: true,
        createdAt: true,
        donor: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                number: true,
              },
            },
          },
        },
        orphan: true,
      },
    });

    if (!sponsorship) {
      throw new NotFoundException(this.t('NOT_FOUND', lang));
    }

    return {
      success: true,
      message: this.t('ADMIN_FETCH_ONE_SUCCESS', lang),
      data: this.toAdminSponsorshipDetailResponse(sponsorship, lang),
    };
  }

  async reviewStatus(
    sponsorshipId: number,
    staffUserId: number,
    dto: ReviewSponsorshipDto,
    lang = 'ar',
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM Sponsorship
        WHERE id = ${sponsorshipId}
        FOR UPDATE
      `;

      const sponsorship = await tx.sponsorship.findUnique({
        where: { id: sponsorshipId },
        select: { id: true, donorId: true, status: true },
      });

      if (!sponsorship) {
        throw new NotFoundException(this.t('NOT_FOUND', lang));
      }

      if (sponsorship.status !== Status.PENDING) {
        throw new BadRequestException(this.t('ALREADY_REVIEWED', lang));
      }

      const employee = await tx.employee.findUnique({
        where: { userId: staffUserId },
        select: { id: true },
      });

      if (dto.status === Status.ACCEPTED) {
        const orphanUpdate = await tx.orphan.updateMany({
          where: { id: dto.orphanId, isSupported: false },
          data: { isSupported: true },
        });

        if (orphanUpdate.count !== 1) {
          throw new BadRequestException(this.t('ORPHAN_NOT_AVAILABLE', lang));
        }

        const sponsorshipUpdate = await tx.sponsorship.updateMany({
          where: { id: sponsorship.id, status: Status.PENDING },
          data: {
            status: Status.ACCEPTED,
            orphanId: dto.orphanId,
            employeeId: employee?.id ?? null,
            startDate: toSponsorshipDatabaseDate(),
            rejectionReason: Prisma.DbNull,
          },
        });

        if (sponsorshipUpdate.count !== 1) {
          throw new BadRequestException(this.t('REVIEW_STATE_CHANGED', lang));
        }

        await tx.donor.update({
          where: { id: sponsorship.donorId },
          data: { isSponsor: true },
        });

        await this.sponsorshipFundService.stopActiveCoveragesForOrphan(
          tx,
          dto.orphanId!,
          new Date(),
        );
      } else {
        const sponsorshipUpdate = await tx.sponsorship.updateMany({
          where: { id: sponsorship.id, status: Status.PENDING },
          data: {
            status: Status.REJECTED,
            employeeId: employee?.id ?? null,
            rejectionReason: {
              ar: dto.rejectionReason!.ar,
              en: dto.rejectionReason!.en,
            },
          },
        });

        if (sponsorshipUpdate.count !== 1) {
          throw new BadRequestException(this.t('REVIEW_STATE_CHANGED', lang));
        }
      }

      const reviewed = await tx.sponsorship.findUnique({
        where: { id: sponsorship.id },
        select: {
          id: true,
          amount: true,
          status: true,
          rejectionReason: true,
          startDate: true,
          endDate: true,
          cancellationSource: true,
          createdAt: true,
          donor: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  number: true,
                },
              },
            },
          },
          orphan: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!reviewed) {
        throw new NotFoundException(this.t('NOT_FOUND', lang));
      }

      return {
        success: true,
        message: this.t(
          dto.status === Status.ACCEPTED ? 'ACCEPT_SUCCESS' : 'REJECT_SUCCESS',
          lang,
        ),
        data: this.toAdminSponsorshipResponse(reviewed, lang),
      };
    });
  }

  async cancel(
    sponsorshipId: number,
    user: SponsorshipUserPayload,
    lang = 'ar',
  ) {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { id: true, userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    return this.prisma.$transaction(async (tx) => {
      const sponsorship = await tx.sponsorship.findFirst({
        where: { id: sponsorshipId, donorId: donor.id },
        select: {
          id: true,
          donorId: true,
          status: true,
          orphanId: true,
          amount: true,
          startDate: true,
        },
      });

      if (!sponsorship) {
        throw new NotFoundException(this.t('NOT_FOUND', lang));
      }

      if (sponsorship.status === Status.CANCELLED) {
        throw new BadRequestException(this.t('ALREADY_CANCELLED', lang));
      }

      if (
        sponsorship.status !== Status.PENDING &&
        sponsorship.status !== Status.ACCEPTED
      ) {
        throw new BadRequestException(this.t('CANCELLATION_NOT_ALLOWED', lang));
      }

      const wasAccepted = sponsorship.status === Status.ACCEPTED;
      const endDate = new Date();
      const updateResult = await tx.sponsorship.updateMany({
        where: {
          id: sponsorship.id,
          donorId: donor.id,
          status: sponsorship.status,
        },
        data: {
          status: Status.CANCELLED,
          endDate,
          cancellationSource: CancellationSource.DONOR,
        },
      });

      if (updateResult.count !== 1) {
        throw new BadRequestException(
          this.t('CANCELLATION_STATE_CHANGED', lang),
        );
      }

      let orphanReleased = false;

      if (wasAccepted) {
        orphanReleased = await this.releaseAcceptedSponsorshipRelations(
          tx,
          sponsorship,
        );

        await this.sponsorshipFundService.createEmergencyCoverageIfEligible(
          tx,
          sponsorship,
          OrphanEmergencyCoverageReason.SPONSOR_CANCELLED,
          endDate,
        );
      }

      const cancelledSponsorship = await tx.sponsorship.findUnique({
        where: { id: sponsorship.id },
        select: {
          id: true,
          donorId: true,
          orphanId: true,
          status: true,
          startDate: true,
          endDate: true,
          cancellationSource: true,
        },
      });

      return {
        success: true,
        message: this.t('CANCEL_SUCCESS', lang),
        data: {
          ...cancelledSponsorship,
          orphanReleased,
        },
      };
    });
  }

  @Cron('5 0 * * *', { timeZone: SPONSORSHIP_TIME_ZONE })
  async handleAutomaticCancellation(): Promise<void> {
    try {
      const cancelledCount = await this.cancelOverdueSponsorships();

      if (cancelledCount > 0) {
        this.logger.log(
          `Automatically cancelled ${cancelledCount} overdue sponsorship(s).`,
        );
      }
    } catch (error) {
      this.logger.error('Automatic sponsorship cancellation failed.', error);
    }
  }

  async cancelOverdueSponsorships(now = new Date()): Promise<number> {
    const window = getPreviousRenewalWindow(now);
    const candidates = await this.prisma.sponsorship.findMany({
      where: {
        status: Status.ACCEPTED,
        startDate: { lt: window.databaseCurrentMonthStart },
      },
      select: { id: true },
    });

    if (candidates.length === 0) return 0;

    const candidateIds = candidates.map(({ id }) => id);
    const payments = await this.prisma.walletTransaction.findMany({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: SPONSORSHIP_REFERENCE_TYPE,
        referenceId: { in: candidateIds },
        createdAt: {
          gte: window.renewalWindowStart,
          lt: window.renewalWindowEnd,
        },
      },
      select: { referenceId: true },
    });
    const paidSponsorshipIds = new Set(
      payments.flatMap(({ referenceId }) =>
        referenceId === null ? [] : [referenceId],
      ),
    );
    const overdueIds = candidateIds.filter((id) => !paidSponsorshipIds.has(id));

    let cancelledCount = 0;

    for (const sponsorshipId of overdueIds) {
      const cancelled = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM Sponsorship
          WHERE id = ${sponsorshipId}
          FOR UPDATE
        `;

        const sponsorship = await tx.sponsorship.findFirst({
          where: {
            id: sponsorshipId,
            status: Status.ACCEPTED,
            startDate: { lt: window.databaseCurrentMonthStart },
          },
          select: {
            id: true,
            donorId: true,
            orphanId: true,
            amount: true,
            status: true,
          },
        });

        if (!sponsorship) return false;

        const payment = await tx.walletTransaction.findFirst({
          where: {
            type: TransactionType.SPONSORSHIP_DONATION,
            direction: WalletTransactionDirection.DEBIT,
            referenceType: SPONSORSHIP_REFERENCE_TYPE,
            referenceId: sponsorship.id,
            createdAt: {
              gte: window.renewalWindowStart,
              lt: window.renewalWindowEnd,
            },
          },
          select: { id: true },
        });

        if (payment) return false;

        const updateResult = await tx.sponsorship.updateMany({
          where: { id: sponsorship.id, status: Status.ACCEPTED },
          data: {
            status: Status.CANCELLED,
            endDate: now,
            cancellationSource: CancellationSource.AUTOMATIC,
          },
        });

        if (updateResult.count !== 1) return false;

        await this.releaseAcceptedSponsorshipRelations(tx, sponsorship);
        await this.sponsorshipFundService.createEmergencyCoverageIfEligible(
          tx,
          sponsorship,
          OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
          now,
        );
        return true;
      });

      if (cancelled) cancelledCount += 1;
    }

    return cancelledCount;
  }

  private async releaseAcceptedSponsorshipRelations(
    tx: Prisma.TransactionClient,
    sponsorship: { id: number; donorId: number; orphanId: number | null },
  ): Promise<boolean> {
    let orphanReleased = false;

    if (sponsorship.orphanId) {
      const otherAcceptedSponsorships = await tx.sponsorship.count({
        where: {
          id: { not: sponsorship.id },
          orphanId: sponsorship.orphanId,
          status: Status.ACCEPTED,
        },
      });

      if (otherAcceptedSponsorships === 0) {
        await tx.orphan.update({
          where: { id: sponsorship.orphanId },
          data: { isSupported: false },
        });
        orphanReleased = true;
      }
    }

    const remainingAcceptedSponsorships = await tx.sponsorship.count({
      where: { donorId: sponsorship.donorId, status: Status.ACCEPTED },
    });

    if (remainingAcceptedSponsorships === 0) {
      await tx.donor.update({
        where: { id: sponsorship.donorId },
        data: { isSponsor: false },
      });
    }

    return orphanReleased;
  }

  private toAdminSponsorshipResponse(
    sponsorship: AdminSponsorshipRecord<AdminSponsorshipOrphanSummary | null>,
    lang: string,
  ) {
    return {
      id: sponsorship.id,
      monthlyAmount: sponsorship.amount.toFixed(2),
      status: sponsorship.status,
      rejectionReason: this.localizeJsonValue(
        sponsorship.rejectionReason,
        lang,
      ),
      startDate: sponsorship.startDate,
      endDate: sponsorship.endDate,
      cancellationSource: sponsorship.cancellationSource,
      createdAt: sponsorship.createdAt,
      donor: {
        id: sponsorship.donor.id,
        firstName: sponsorship.donor.user.firstName,
        lastName: sponsorship.donor.user.lastName,
        email: sponsorship.donor.user.email,
        number: sponsorship.donor.user.number,
      },
      orphan: sponsorship.orphan,
    };
  }

  private toAdminSponsorshipDetailResponse(
    sponsorship: AdminSponsorshipRecord<AdminSponsorshipOrphanDetails | null>,
    lang: string,
  ) {
    return {
      ...this.toAdminSponsorshipResponse(sponsorship, lang),
      orphan: sponsorship.orphan
        ? {
            ...sponsorship.orphan,
            class: this.localizeJsonValue(sponsorship.orphan.class, lang),
            Diseases: this.localizeJsonValue(sponsorship.orphan.Diseases, lang),
            currentAddress: this.localizeJsonValue(
              sponsorship.orphan.currentAddress,
              lang,
            ),
            previousAddress: this.localizeJsonValue(
              sponsorship.orphan.previousAddress,
              lang,
            ),
            talent: this.localizeJsonValue(sponsorship.orphan.talent, lang),
          }
        : null,
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

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
    lang: string,
  ): number {
    if (value === undefined || value === '') return defaultValue;

    const normalizedValue = value.trim();
    const parsed = Number(normalizedValue);

    if (
      !/^\d+$/.test(normalizedValue) ||
      !Number.isSafeInteger(parsed) ||
      parsed <= 0
    ) {
      throw new BadRequestException(this.t('INVALID_PAGINATION', lang));
    }

    return parsed;
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
