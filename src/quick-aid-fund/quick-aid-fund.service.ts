import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Status,
  TransactionStatus,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuickAidDisbursementDto } from './dto/create-quick-aid-disbursement.dto';

const FUND_CURRENCY = 'USD';
type FundPrisma = PrismaService | Prisma.TransactionClient;

@Injectable()
export class QuickAidFundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getSummary(lang = 'ar') {
    const totals = await this.getTotals();

    return {
      success: true,
      message: this.t('SUMMARY_FETCH_SUCCESS', lang),
      data: {
        totalDonations: totals.totalDonations.toFixed(2),
        totalDisbursed: totals.totalDisbursed.toFixed(2),
        currentBalance: totals.totalDonations
          .minus(totals.totalDisbursed)
          .toFixed(2),
        currency: FUND_CURRENCY,
      },
    };
  }

  async createDisbursement(
    dto: CreateQuickAidDisbursementDto,
    staffUserId: number,
    lang = 'ar',
  ) {
    const amount = new Prisma.Decimal(dto.amount);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const employee = await tx.employee.findFirst({
            where: {
              userId: staffUserId,
              user: { userType: UserType.EMPLOYEE },
            },
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true } },
            },
          });

          if (!employee) {
            throw new NotFoundException(this.t('EMPLOYEE_NOT_FOUND', lang));
          }

          const beneficiary = await tx.beneficiary.findUnique({
            where: { id: dto.beneficiaryId },
            select: {
              id: true,
              status: true,
              user: { select: { firstName: true, lastName: true } },
            },
          });

          if (!beneficiary) {
            throw new NotFoundException(this.t('BENEFICIARY_NOT_FOUND', lang));
          }

          if (beneficiary.status !== Status.ACCEPTED) {
            throw new BadRequestException(
              this.t('BENEFICIARY_NOT_ACCEPTED', lang),
            );
          }

          const totals = await this.getTotals(tx);
          const currentBalance = totals.totalDonations.minus(
            totals.totalDisbursed,
          );

          if (currentBalance.lt(amount)) {
            throw new BadRequestException(
              this.t('INSUFFICIENT_FUND_BALANCE', lang),
            );
          }

          const reason = dto.reason as unknown as Prisma.InputJsonValue;
          const disbursement = await tx.quickAidDisbursement.create({
            data: {
              beneficiaryId: beneficiary.id,
              employeeId: employee.id,
              amount,
              reason,
            },
            select: {
              id: true,
              beneficiaryId: true,
              amount: true,
              reason: true,
              createdAt: true,
            },
          });

          return {
            success: true,
            message: this.t('DISBURSEMENT_CREATE_SUCCESS', lang),
            data: {
              id: disbursement.id,
              beneficiaryId: disbursement.beneficiaryId,
              beneficiary: {
                firstName: beneficiary.user.firstName,
                lastName: beneficiary.user.lastName,
              },
              employee: {
                id: employee.id,
                firstName: employee.user.firstName,
                lastName: employee.user.lastName,
              },
              amount: disbursement.amount.toFixed(2),
              reason: disbursement.reason as unknown as {
                ar: string;
                en: string;
              },
              balanceAfter: currentBalance.minus(amount).toFixed(2),
              currency: FUND_CURRENCY,
              createdAt: disbursement.createdAt,
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new BadRequestException(
          this.t('DISBURSEMENT_CONCURRENT_UPDATE', lang),
        );
      }

      throw error;
    }
  }

  async findDisbursements(
    pageInput?: string,
    limitInput?: string,
    lang = 'ar',
  ) {
    const page = this.parsePositiveInteger(pageInput, 1, lang);
    const limit = this.parsePositiveInteger(limitInput, 10, lang);
    const skip = (page - 1) * limit;

    const [disbursements, totalCount] = await Promise.all([
      this.prisma.quickAidDisbursement.findMany({
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          beneficiaryId: true,
          amount: true,
          reason: true,
          beneficiary: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          employee: {
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.quickAidDisbursement.count(),
    ]);
    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      message: this.t('DISBURSEMENTS_FETCH_SUCCESS', lang),
      data: disbursements.map((disbursement) => ({
        beneficiaryId: disbursement.beneficiaryId,
        beneficiary: {
          firstName: disbursement.beneficiary.user.firstName,
          lastName: disbursement.beneficiary.user.lastName,
        },
        employee: {
          id: disbursement.employee.id,
          firstName: disbursement.employee.user.firstName,
          lastName: disbursement.employee.user.lastName,
        },
        amount: disbursement.amount.toFixed(2),
        reason: disbursement.reason as unknown as {
          ar: string;
          en: string;
        },
      })),
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

  private async getTotals(prisma: FundPrisma = this.prisma) {
    const [stripeDonations, walletDonations, disbursements] =
      await Promise.all([
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            type: TransactionType.QUICK_AID_FUND_DONATION,
            status: TransactionStatus.SUCCESSFUL,
          },
        }),
        prisma.walletTransaction.aggregate({
          _sum: { amount: true },
          where: {
            type: TransactionType.QUICK_AID_FUND_DONATION,
            direction: WalletTransactionDirection.DEBIT,
          },
        }),
        prisma.quickAidDisbursement.aggregate({
          _sum: { amount: true },
        }),
      ]);

    return {
      totalDonations: new Prisma.Decimal(stripeDonations._sum.amount ?? 0).plus(
        walletDonations._sum.amount ?? 0,
      ),
      totalDisbursed: new Prisma.Decimal(disbursements._sum.amount ?? 0),
    };
  }

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
    lang: string,
  ): number {
    if (value === undefined || value === '') return defaultValue;

    const normalized = String(value).trim();
    const parsed = Number(normalized);

    if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException(this.t('INVALID_PAGINATION', lang));
    }

    return parsed;
  }

  private t(key: string, lang: string): string {
    return this.i18n.t(`quick-aid-fund.${key}`, { lang });
  }
}
