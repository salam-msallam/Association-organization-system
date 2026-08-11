import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  OrphanEmergencyCoverageReason,
  OrphanEmergencyCoverageStatus,
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  WalletTransactionDirection,
} from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import {
  getSponsorshipPaymentContext,
  SPONSORSHIP_TIME_ZONE,
} from './sponsorship-billing-period';

const EMERGENCY_SUPPORT_MONTHS_LIMIT = 2;
const EMERGENCY_SUPPORT_RATE = new Prisma.Decimal('0.5');
const COVERAGE_STATUSES = Object.values(OrphanEmergencyCoverageStatus);

type FundPrisma = PrismaService | Prisma.TransactionClient;

type CoverageSponsorship = {
  id: number;
  orphanId: number | null;
  amount: Prisma.Decimal;
};

@Injectable()
export class SponsorshipFundService {
  private readonly logger = new Logger(SponsorshipFundService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly i18n?: I18nService,
  ) {}

  async getSponsorshipFundBalance(
    prisma: FundPrisma = this.prisma,
  ): Promise<Prisma.Decimal> {
    const totals = await this.getSponsorshipFundTotals(prisma);

    return totals.totalDonations.minus(totals.totalDistributed);
  }

  async getAdminSummary(lang = 'ar') {
    const [
      currentBalance,
      totals,
      activeCoverages,
      supportedOrphans,
    ] = await Promise.all([
      this.getSponsorshipFundBalance(),
      this.getSponsorshipFundTotals(),
      this.prisma.orphanEmergencyCoverage.count({
        where: { status: OrphanEmergencyCoverageStatus.ACTIVE },
      }),
      this.prisma.orphanEmergencyCoverage.findMany({
        distinct: ['orphanId'],
        select: { orphanId: true },
      }),
    ]);

    return {
      success: true,
      message: this.t('SPONSORSHIP_FUND_SUMMARY_FETCH_SUCCESS', lang),
      data: {
        currentBalance: currentBalance.toFixed(2),
        totalDonations: totals.totalDonations.toFixed(2),
        totalDistributed: totals.totalDistributed.toFixed(2),
        activeCoverages,
        totalSupportedOrphans: supportedOrphans.length,
      },
    };
  }

  async findAdminCoverages(
    status?: string,
    pageInput?: string,
    limitInput?: string,
    lang = 'ar',
  ) {
    const normalizedStatus = this.normalizeCoverageStatus(status, lang);
    const { page, limit, skip } = this.getPagination(pageInput, limitInput, lang);
    const where: Prisma.OrphanEmergencyCoverageWhereInput = normalizedStatus
      ? { status: normalizedStatus }
      : {};

    const [coverages, totalCount] = await Promise.all([
      this.prisma.orphanEmergencyCoverage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          orphanId: true,
          sponsorshipId: true,
          originalAmount: true,
          monthlySupport: true,
          supportedMonths: true,
          status: true,
          reason: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          orphan: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fatherName: true,
              motherName: true,
              birthOfDate: true,
              gender: true,
            },
          },
        },
      }),
      this.prisma.orphanEmergencyCoverage.count({ where }),
    ]);

    return {
      success: true,
      message: this.t('SPONSORSHIP_FUND_COVERAGES_FETCH_SUCCESS', lang),
      data: coverages.map((coverage) => ({
        id: coverage.id,
        orphanId: coverage.orphanId,
        sponsorshipId: coverage.sponsorshipId,
        originalAmount: coverage.originalAmount.toFixed(2),
        monthlySupport: coverage.monthlySupport.toFixed(2),
        supportedMonths: coverage.supportedMonths,
        status: coverage.status,
        reason: coverage.reason,
        startDate: coverage.startDate,
        endDate: coverage.endDate,
        createdAt: coverage.createdAt,
        updatedAt: coverage.updatedAt,
        orphan: coverage.orphan,
      })),
      meta: this.getPaginationMeta(totalCount, page, limit),
    };
  }

  async findAdminSupports(
    pageInput?: string,
    limitInput?: string,
    lang = 'ar',
  ) {
    const { page, limit, skip } = this.getPagination(pageInput, limitInput, lang);

    const [supports, totalCount] = await Promise.all([
      this.prisma.sponsorshipFundSupport.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          coverageId: true,
          amount: true,
          balanceAfter: true,
          createdAt: true,
          coverage: {
            select: {
              orphan: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  fatherName: true,
                  motherName: true,
                  birthOfDate: true,
                  gender: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.sponsorshipFundSupport.count(),
    ]);

    return {
      success: true,
      message: this.t('SPONSORSHIP_FUND_SUPPORTS_FETCH_SUCCESS', lang),
      data: supports.map((support) => ({
        id: support.id,
        coverageId: support.coverageId,
        amount: support.amount.toFixed(2),
        balanceAfter: support.balanceAfter.toFixed(2),
        createdAt: support.createdAt,
        orphan: support.coverage.orphan,
      })),
      meta: this.getPaginationMeta(totalCount, page, limit),
    };
  }

  private async getSponsorshipFundTotals(prisma: FundPrisma = this.prisma) {
    const [stripeDonations, walletDonations, fundSupports] =
      await Promise.all([
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            type: TransactionType.GENERAL_DONATION,
            status: TransactionStatus.SUCCESSFUL,
          },
        }),
        prisma.walletTransaction.aggregate({
          _sum: { amount: true },
          where: {
            type: TransactionType.GENERAL_DONATION,
            direction: WalletTransactionDirection.DEBIT,
          },
        }),
        prisma.sponsorshipFundSupport.aggregate({
          _sum: { amount: true },
        }),
      ]);

    const totalDonations = new Prisma.Decimal(stripeDonations._sum.amount ?? 0)
      .plus(walletDonations._sum.amount ?? 0);
    const totalDistributed = new Prisma.Decimal(fundSupports._sum.amount ?? 0);

    return {
      totalDonations,
      totalDistributed,
    };
  }

  async createEmergencyCoverageIfEligible(
    tx: Prisma.TransactionClient,
    sponsorship: CoverageSponsorship,
    reason: OrphanEmergencyCoverageReason,
    now = new Date(),
  ): Promise<boolean> {
    if (!sponsorship.orphanId) return false;

    const [acceptedSponsorship, activeCoverage] = await Promise.all([
      tx.sponsorship.findFirst({
        where: {
          orphanId: sponsorship.orphanId,
          status: Status.ACCEPTED,
        },
        select: { id: true },
      }),
      tx.orphanEmergencyCoverage.findFirst({
        where: {
          sponsorshipId: sponsorship.id,
          status: OrphanEmergencyCoverageStatus.ACTIVE,
        },
        select: { id: true },
      }),
    ]);

    if (acceptedSponsorship || activeCoverage) return false;

    await tx.orphanEmergencyCoverage.create({
      data: {
        orphanId: sponsorship.orphanId,
        sponsorshipId: sponsorship.id,
        originalAmount: sponsorship.amount,
        monthlySupport: new Prisma.Decimal(sponsorship.amount).times(
          EMERGENCY_SUPPORT_RATE,
        ),
        supportedMonths: 0,
        startDate: now,
        status: OrphanEmergencyCoverageStatus.ACTIVE,
        reason,
      },
    });

    return true;
  }

  async stopActiveCoveragesForOrphan(
    tx: Prisma.TransactionClient,
    orphanId: number,
    now = new Date(),
  ): Promise<number> {
    const result = await tx.orphanEmergencyCoverage.updateMany({
      where: {
        orphanId,
        status: OrphanEmergencyCoverageStatus.ACTIVE,
      },
      data: {
        status: OrphanEmergencyCoverageStatus.STOPPED_NEW_SPONSOR,
        endDate: now,
      },
    });

    return result.count;
  }

  @Cron('10 0 * * *', { timeZone: SPONSORSHIP_TIME_ZONE })
  async handleMonthlyEmergencyCoverageSupport(): Promise<void> {
    try {
      const processedCount = await this.processMonthlyEmergencyCoverages();

      if (processedCount > 0) {
        this.logger.log(
          `Processed ${processedCount} emergency coverage support item(s).`,
        );
      }
    } catch (error) {
      this.logger.error('Emergency coverage support processing failed.', error);
    }
  }

  async processMonthlyEmergencyCoverages(now = new Date()): Promise<number> {
    const paymentContext = getSponsorshipPaymentContext(now);

    if (!paymentContext.isRenewalWindowOpen) return 0;

    const coverages = await this.prisma.orphanEmergencyCoverage.findMany({
      where: {
        status: OrphanEmergencyCoverageStatus.ACTIVE,
        supportedMonths: { lt: EMERGENCY_SUPPORT_MONTHS_LIMIT },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    let processedCount = 0;

    for (const coverage of coverages) {
      const processed = await this.processOneMonthlyEmergencyCoverage(
        coverage.id,
        paymentContext.renewalWindowStart,
        paymentContext.renewalWindowEnd,
        now,
      );

      if (processed) processedCount += 1;
    }

    return processedCount;
  }

  private normalizeCoverageStatus(
    status: string | undefined,
    lang: string,
  ): OrphanEmergencyCoverageStatus | undefined {
    if (!status) return undefined;

    const normalizedStatus = status.trim().toUpperCase();

    if (
      !COVERAGE_STATUSES.includes(
        normalizedStatus as OrphanEmergencyCoverageStatus,
      )
    ) {
      throw new BadRequestException(
        this.t('INVALID_SPONSORSHIP_FUND_COVERAGE_STATUS', lang),
      );
    }

    return normalizedStatus as OrphanEmergencyCoverageStatus;
  }

  private getPagination(
    pageInput: string | undefined,
    limitInput: string | undefined,
    lang: string,
  ) {
    const page = this.parsePositiveInteger(pageInput, 1, lang);
    const limit = this.parsePositiveInteger(limitInput, 10, lang);

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
    lang: string,
  ): number {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    const normalizedValue = String(value).trim();
    const parsed = Number(normalizedValue);

    if (
      !/^\d+$/.test(normalizedValue) ||
      !Number.isSafeInteger(parsed) ||
      parsed < 1
    ) {
      throw new BadRequestException(this.t('INVALID_PAGINATION', lang));
    }

    return parsed;
  }

  private getPaginationMeta(totalCount: number, page: number, limit: number) {
    const totalPages = Math.ceil(totalCount / limit);

    return {
      totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  private t(key: string, lang: string): string {
    const fallbackMessages: Record<string, string> = {
      SPONSORSHIP_FUND_SUMMARY_FETCH_SUCCESS:
        'Sponsorship fund summary fetched successfully.',
      SPONSORSHIP_FUND_COVERAGES_FETCH_SUCCESS:
        'Sponsorship fund coverages fetched successfully.',
      SPONSORSHIP_FUND_SUPPORTS_FETCH_SUCCESS:
        'Sponsorship fund supports fetched successfully.',
      INVALID_SPONSORSHIP_FUND_COVERAGE_STATUS:
        'The sponsorship fund coverage status is invalid.',
      INVALID_PAGINATION: 'page and limit must be positive integers.',
    };

    return String(
      this.i18n?.t(`sponsorship.${key}`, { lang }) ?? fallbackMessages[key] ?? key,
    );
  }

  private async processOneMonthlyEmergencyCoverage(
    coverageId: number,
    renewalWindowStart: Date,
    renewalWindowEnd: Date,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM OrphanEmergencyCoverage
          WHERE id = ${coverageId}
          FOR UPDATE
        `;

        const coverage = await tx.orphanEmergencyCoverage.findUnique({
          where: { id: coverageId },
          select: {
            id: true,
            orphanId: true,
            monthlySupport: true,
            supportedMonths: true,
            status: true,
          },
        });

        if (
          !coverage ||
          coverage.status !== OrphanEmergencyCoverageStatus.ACTIVE ||
          coverage.supportedMonths >= EMERGENCY_SUPPORT_MONTHS_LIMIT
        ) {
          return false;
        }

        const paymentInCurrentWindow =
          await tx.sponsorshipFundSupport.findFirst({
            where: {
              coverageId: coverage.id,
              createdAt: {
                gte: renewalWindowStart,
                lt: renewalWindowEnd,
              },
            },
            select: { id: true },
          });

        if (paymentInCurrentWindow) return false;

        const acceptedSponsorship = await tx.sponsorship.findFirst({
          where: {
            orphanId: coverage.orphanId,
            status: Status.ACCEPTED,
          },
          select: { id: true },
        });

        if (acceptedSponsorship) {
          await tx.orphanEmergencyCoverage.update({
            where: { id: coverage.id },
            data: {
              status: OrphanEmergencyCoverageStatus.STOPPED_NEW_SPONSOR,
              endDate: now,
            },
          });

          return true;
        }

        const fundBalance = await this.getSponsorshipFundBalance(tx);
        const monthlySupport = new Prisma.Decimal(coverage.monthlySupport);

        if (fundBalance.lt(monthlySupport)) {
          await tx.orphanEmergencyCoverage.update({
            where: { id: coverage.id },
            data: {
              status:
                OrphanEmergencyCoverageStatus.STOPPED_INSUFFICIENT_FUNDS,
              endDate: now,
            },
          });

          return true;
        }

        const balanceAfter = fundBalance.minus(monthlySupport);
        const nextSupportedMonths = coverage.supportedMonths + 1;

        await tx.sponsorshipFundSupport.create({
          data: {
            coverageId: coverage.id,
            amount: monthlySupport,
            balanceAfter,
            createdAt: now,
          },
        });

        await tx.orphanEmergencyCoverage.update({
          where: { id: coverage.id },
          data: {
            supportedMonths: nextSupportedMonths,
            ...(nextSupportedMonths >= EMERGENCY_SUPPORT_MONTHS_LIMIT
              ? {
                  status: OrphanEmergencyCoverageStatus.COMPLETED,
                  endDate: now,
                }
              : {}),
          },
        });

        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
