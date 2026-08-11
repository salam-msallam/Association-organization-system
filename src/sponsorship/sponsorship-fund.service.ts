import { Injectable, Logger } from '@nestjs/common';
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
import { PrismaService } from '../prisma/prisma.service';
import {
  getSponsorshipPaymentContext,
  SPONSORSHIP_TIME_ZONE,
} from './sponsorship-billing-period';

const EMERGENCY_SUPPORT_MONTHS_LIMIT = 2;
const EMERGENCY_SUPPORT_RATE = new Prisma.Decimal('0.5');

type FundPrisma = PrismaService | Prisma.TransactionClient;

type CoverageSponsorship = {
  id: number;
  orphanId: number | null;
  amount: Prisma.Decimal;
};

@Injectable()
export class SponsorshipFundService {
  private readonly logger = new Logger(SponsorshipFundService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSponsorshipFundBalance(
    prisma: FundPrisma = this.prisma,
  ): Promise<Prisma.Decimal> {
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

    return new Prisma.Decimal(stripeDonations._sum.amount ?? 0)
      .plus(walletDonations._sum.amount ?? 0)
      .minus(fundSupports._sum.amount ?? 0);
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
