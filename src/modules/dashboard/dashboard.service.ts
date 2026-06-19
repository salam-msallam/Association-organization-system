import { Injectable } from '@nestjs/common';
import { Status, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date(); 

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalDonationsAggregate,
      currentMonthDonations,
      previousMonthDonations,
      completedCasesCount,
      targetedCasesCount,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { paymentStatus: TransactionStatus.SUCCESSFUL },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          paymentStatus: TransactionStatus.SUCCESSFUL,
          createdAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          paymentStatus: TransactionStatus.SUCCESSFUL,
          createdAt: { gte: previousMonthStart, lt: currentMonthStart },
        },
      }),
      this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM RequestAid 
        WHERE status = 'accepted' AND currentPayment >= cost
      `.then(result => Number(result[0]?.count || 0)),
      this.prisma.requestAid.count({
        where: { status: 'ACCEPTED' as any  },
      }),
    ]);

    const totalDonations = Number(totalDonationsAggregate._sum?.amount ?? 0);
    const curMonthSum = Number(currentMonthDonations._sum?.amount ?? 0);
    const prevMonthSum = Number(previousMonthDonations._sum?.amount ?? 0);

    let growthRate = 0;
    if (prevMonthSum === 0) {
      growthRate = curMonthSum > 0 ? 100 : 0;
    } else {
      growthRate = ((curMonthSum - prevMonthSum) / prevMonthSum) * 100;
    }

    return {
      total_donations: totalDonations,
      donations_growth_percentage: Math.round((growthRate + Number.EPSILON) * 100) / 100,
      completed_cases: completedCasesCount,
      targeted_completed_cases: targetedCasesCount,
    };
  }
}