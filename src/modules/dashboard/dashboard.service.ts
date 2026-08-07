import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  WalletTransactionDirection,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { HelpRequestStatsResponseDto } from './dto/help-request-stats-response.dto';
import { DashboardUsersCountResponseDto } from './dto/dashboard-users-count-response.dto';
import {
  AidRequestCategoryDistributionItemDto,
  AnnualDonationDistributionItemDto,
  MonthlyDonationDistributionItemDto,
  OrphanStatisticsResponseDto,
  SponsorshipStatisticsResponseDto,
} from './dto/admin-dashboard-statistics-response.dto';

const ACTUAL_DONATION_TYPES = [
  TransactionType.AID_REQUEST_DONATION,
  TransactionType.SPONSORSHIP_DONATION,
  TransactionType.GENERAL_DONATION,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );

    const [
      totalDonations,
      curMonthSum,
      prevMonthSum,
      completedCasesCount,
      targetedCasesCount,
    ] = await Promise.all([
      this.sumActualDonations(),
      this.sumActualDonations(currentMonthStart, nextMonthStart),
      this.sumActualDonations(previousMonthStart, currentMonthStart),
      this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM RequestAid 
        WHERE status = ${Status.ACCEPTED} AND currentPayment >= cost
      `.then(result => Number(result[0]?.count || 0)),
      this.prisma.requestAid.count({
        where: { status: Status.ACCEPTED },
      }),
    ]);

    let growthRate: number | null = 0;
    if (prevMonthSum === 0) {
      growthRate = curMonthSum > 0 ? 100 : 0;
    } else {
      growthRate = ((curMonthSum - prevMonthSum) / prevMonthSum) * 100;
    }

    return {
      total_donations: totalDonations,
      donations_growth_percentage:
        growthRate === null
          ? null
          : Math.round((growthRate + Number.EPSILON) * 100) / 100,
      completed_cases: completedCasesCount,
      targeted_completed_cases: targetedCasesCount,
    };
  }

  async getUsersCount(): Promise<DashboardUsersCountResponseDto> {
    const [donorsCount, beneficiariesCount] = await Promise.all([
      this.prisma.donor.count(),
      this.prisma.beneficiary.count(),
    ]);

    return {
      donors_count: donorsCount,
      beneficiaries_count: beneficiariesCount,
    };
  }

  async getDonationDistribution(
    period: 'annual' | 'monthly',
  ): Promise<
    AnnualDonationDistributionItemDto[] | MonthlyDonationDistributionItemDto[]
  > {
    const now = new Date();

    if (period === 'annual') {
      const currentYear = now.getFullYear();
      const years = Array.from(
        { length: 5 },
        (_, index) => currentYear - 4 + index,
      );

      return Promise.all(
        years.map(async (year) => ({
          year,
          amount: await this.sumActualDonations(
            new Date(year, 0, 1),
            new Date(year + 1, 0, 1),
          ),
        })),
      );
    }

    const year = now.getFullYear();
    const months = Array.from({ length: 12 }, (_, index) => index + 1);

    return Promise.all(
      months.map(async (month) => ({
        month,
        amount: await this.sumActualDonations(
          new Date(year, month - 1, 1),
          new Date(year, month, 1),
        ),
      })),
    );
  }

  async getAidRequestCategoryDistribution(): Promise<
    AidRequestCategoryDistributionItemDto[]
  > {
    const categories = await this.prisma.category.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        _count: { select: { requests: true } },
      },
    });

    return categories.map((category) => ({
      category_id: category.id,
      category: category.name,
      count: category._count.requests,
    }));
  }

  async getSponsorshipStatistics(): Promise<SponsorshipStatisticsResponseDto> {
    const statusCounts = await this.prisma.sponsorship.groupBy({
      by: ['status'],
      where: {
        status: {
          in: [Status.ACCEPTED, Status.PENDING, Status.REJECTED],
        },
      },
      _count: { _all: true },
    });

    const countByStatus = new Map(
      statusCounts.map(({ status, _count }) => [status, _count._all]),
    );

    return {
      accepted: countByStatus.get(Status.ACCEPTED) ?? 0,
      pending: countByStatus.get(Status.PENDING) ?? 0,
      rejected: countByStatus.get(Status.REJECTED) ?? 0,
    };
  }

  async getOrphanStatistics(): Promise<OrphanStatisticsResponseDto> {
    const [sponsored, notSponsored] = await Promise.all([
      this.prisma.orphan.count({ where: { isSupported: true } }),
      this.prisma.orphan.count({ where: { isSupported: false } }),
    ]);

    return {
      sponsored,
      not_sponsored: notSponsored,
    };
  }

  async getHelpRequestStats(): Promise<HelpRequestStatsResponseDto> {
    const [statusCounts, urgentCases, averageReviewTimeResult] =
      await Promise.all([
        this.prisma.requestAid.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.requestAid.count({
          where: {
            isUrgent: true,
            status: Status.ACCEPTED,
          },
        }),
        this.prisma.$queryRaw<
          Array<{ avgReviewTimeDays: Prisma.Decimal | number | null }>
        >`
          SELECT AVG(
            TIMESTAMPDIFF(MICROSECOND, createdAt, reviewedAt) / 86400000000.0
          ) AS avgReviewTimeDays
          FROM RequestAid
          WHERE status = ${Status.ACCEPTED}
            AND isUrgent = true
            AND reviewedAt IS NOT NULL
            AND reviewedAt >= createdAt
        `,
      ]);

    const countByStatus = new Map(
      statusCounts.map(({ status, _count }) => [status, _count._all]),
    );
    const averageReviewTimeDays = Number(
      averageReviewTimeResult[0]?.avgReviewTimeDays ?? 0,
    );

    return {
      pending_count: countByStatus.get(Status.PENDING) ?? 0,
      accepted_count: countByStatus.get(Status.ACCEPTED) ?? 0,
      rejected_count: countByStatus.get(Status.REJECTED) ?? 0,
      cancelled_count: countByStatus.get(Status.CANCELLED) ?? 0,
      urgent_cases: urgentCases,
      avg_review_time_days:
        Math.round((averageReviewTimeDays + Number.EPSILON) * 10) / 10,
    };
  }

  private async sumActualDonations(start?: Date, end?: Date): Promise<number> {
    const createdAt =
      start || end
        ? {
            ...(start ? { gte: start } : {}),
            ...(end ? { lt: end } : {}),
          }
        : undefined;

    const [transactionDonations, walletDonations] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          status: TransactionStatus.SUCCESSFUL,
          type: { in: ACTUAL_DONATION_TYPES },
          ...(createdAt ? { createdAt } : {}),
        },
      }),
      this.prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: {
          transactionId: null,
          direction: WalletTransactionDirection.DEBIT,
          type: { in: ACTUAL_DONATION_TYPES },
          ...(createdAt ? { createdAt } : {}),
        },
      }),
    ]);

    return (
      Number(transactionDonations._sum?.amount ?? 0) +
      Number(walletDonations._sum?.amount ?? 0)
    );
  }
}
