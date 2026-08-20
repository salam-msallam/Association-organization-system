import {
  Prisma,
  PrismaClient,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

const QUICK_AID_FUND_AMOUNTS = ['50.00', '75.00', '100.00', '125.00', '150.00'];

export interface QuickAidFundTransactionSeedResult {
  createdCount: number;
  totalAmount: string;
}

export async function seedQuickAidFundTransactions(
  prisma: PrismaClient,
): Promise<QuickAidFundTransactionSeedResult> {
  return prisma.$transaction(async (transaction) => {
    const donors = await transaction.donor.findMany({
      take: QUICK_AID_FUND_AMOUNTS.length,
      orderBy: { userId: 'asc' },
      select: { userId: true },
    });

    if (donors.length === 0) {
      throw new Error(
        'Quick aid fund transaction seed requires at least one existing donor.',
      );
    }

    const currentYear = new Date().getUTCFullYear();
    const records: Prisma.TransactionCreateManyInput[] =
      QUICK_AID_FUND_AMOUNTS.map((amount, index) => ({
        donorId: donors[index % donors.length].userId,
        stripePaymentIntentId: `pi_quick_aid_fund_seed_${index + 1}`,
        idempotencyKey: `payment-intent:quick-aid-fund-seed-${index + 1}`,
        amount: new Prisma.Decimal(amount),
        status: TransactionStatus.SUCCESSFUL,
        type: TransactionType.QUICK_AID_FUND_DONATION,
        referenceType: null,
        referenceId: null,
        currency: 'usd',
        createdAt: new Date(Date.UTC(currentYear, 7, 16 + index, 10)),
      }));

    const result = await transaction.transaction.createMany({
      data: records,
      skipDuplicates: true,
    });
    const seededTransactions = await transaction.transaction.aggregate({
      _sum: { amount: true },
      where: {
        stripePaymentIntentId: {
          in: records.map((record) => record.stripePaymentIntentId!),
        },
      },
    });

    return {
      createdCount: result.count,
      totalAmount: new Prisma.Decimal(
        seededTransactions._sum.amount ?? 0,
      ).toFixed(2),
    };
  });
}
