import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
  WalletTransactionDirection,
} from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminDonorHistoryResponseDto,
  AdminDonorListResponseDto,
  DonorHistoryAidRequestDto,
  DonorHistoryItemDto,
  DonorHistoryOrphanDto,
} from './dto/donor-response.dto';

const REQUEST_AID_REFERENCE_TYPE = 'REQUEST_AID';

type FinancialRecord = {
  amount: Prisma.Decimal;
  type: TransactionType;
  createdAt: Date;
  referenceType: string | null;
  referenceId: number | null;
};

type AidRequestMap = Map<number, DonorHistoryAidRequestDto>;
type OrphanMap = Map<number, DonorHistoryOrphanDto>;

@Injectable()
export class DonorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async findAll(
    pageInput?: string,
    limitInput?: string,
    isSponsorInput?: string,
    lang = 'ar',
  ): Promise<AdminDonorListResponseDto> {
    const page = this.parsePositiveInteger(pageInput, 1, lang);
    const limit = this.parsePositiveInteger(limitInput, 10, lang);
    const isSponsor = this.parseOptionalBoolean(isSponsorInput, lang);
    const skip = (page - 1) * limit;
    const where: Prisma.DonorWhereInput =
      isSponsor === undefined ? {} : { isSponsor };

    const [donors, totalCount] = await Promise.all([
      this.prisma.donor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { user: { createdAt: 'desc' } },
        select: {
          id: true,
          userId: true,
          isSponsor: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              number: true,
              countryCode: true,
              countryName: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.donor.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      message: this.t('FETCH_SUCCESS', lang),
      data: donors.map((donor) => ({
        donorId: donor.id,
        userId: donor.userId,
        firstName: donor.user.firstName,
        lastName: donor.user.lastName,
        email: donor.user.email,
        number: donor.user.number,
        countryCode: donor.user.countryCode,
        countryName: donor.user.countryName,
        isSponsor: donor.isSponsor,
        createdAt: donor.user.createdAt,
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

  async getHistory(
    donorIdInput: string | number,
    lang = 'ar',
  ): Promise<AdminDonorHistoryResponseDto> {
    const donorId = this.parsePositiveInteger(donorIdInput, undefined, lang, {
      messageKey: 'INVALID_ID',
    });

    const donor = await this.prisma.donor.findUnique({
      where: { id: donorId },
      select: { id: true, userId: true },
    });

    if (!donor) {
      throw new NotFoundException(this.t('NOT_FOUND', lang));
    }

    const { start, end } = this.getCurrentYearRange();

    const [transactions, wallet] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          donorId: donor.userId,
          status: TransactionStatus.SUCCESSFUL,
          createdAt: { gte: start, lt: end },
          type: {
            in: [
              TransactionType.AID_REQUEST_DONATION,
              TransactionType.WALLET_TOP_UP,
              TransactionType.GENERAL_DONATION,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          amount: true,
          type: true,
          createdAt: true,
          referenceType: true,
          referenceId: true,
        },
      }),
      this.prisma.wallet.findUnique({
        where: { donorId: donor.userId },
        select: {
          id: true,
          transactions: {
            where: {
              createdAt: { gte: start, lt: end },
              direction: WalletTransactionDirection.DEBIT,
              type: {
                in: [
                  TransactionType.AID_REQUEST_DONATION,
                  TransactionType.SPONSORSHIP_DONATION,
                ],
              },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              amount: true,
              type: true,
              createdAt: true,
              referenceType: true,
              referenceId: true,
            },
          },
        },
      }),
    ]);

    const walletTransactions = wallet?.transactions ?? [];
    const aidRequestMap = await this.getAidRequestMap([
      ...transactions,
      ...walletTransactions,
    ]);
    const orphanMap = await this.getOrphanMap(walletTransactions);

    const data = [
      ...transactions.map((transaction) =>
        this.mapTransaction(transaction, aidRequestMap),
      ),
      ...walletTransactions.map((transaction) =>
        this.mapWalletTransaction(transaction, aidRequestMap, orphanMap),
      ),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      success: true,
      message: this.t('HISTORY_FETCH_SUCCESS', lang),
      data,
    };
  }

  private async getAidRequestMap(
    records: FinancialRecord[],
  ): Promise<AidRequestMap> {
    const ids = [
      ...new Set(
        records
          .filter(
            (record) =>
              record.type === TransactionType.AID_REQUEST_DONATION &&
              record.referenceType === REQUEST_AID_REFERENCE_TYPE &&
              record.referenceId,
          )
          .map((record) => record.referenceId as number),
      ),
    ];

    if (ids.length === 0) return new Map();

    const requests = await this.prisma.requestAid.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });

    return new Map(
      requests.map((request) => [
        request.id,
        {
          id: request.id,
          title: request.title,
        },
      ]),
    );
  }

  private async getOrphanMap(records: FinancialRecord[]): Promise<OrphanMap> {
    const referenceIds = [
      ...new Set(
        records
          .filter(
            (record) =>
              record.type === TransactionType.SPONSORSHIP_DONATION &&
              record.referenceId,
          )
          .map((record) => record.referenceId as number),
      ),
    ];

    if (referenceIds.length === 0) return new Map();

    const sponsorships = await this.prisma.sponsorship.findMany({
      where: { id: { in: referenceIds } },
      select: {
        id: true,
        orphan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    const sponsorshipMap: OrphanMap = new Map();

    for (const sponsorship of sponsorships) {
      if (!sponsorship.orphan) continue;

      sponsorshipMap.set(sponsorship.id, {
        id: sponsorship.orphan.id,
        firstName: sponsorship.orphan.firstName,
        lastName: sponsorship.orphan.lastName,
      });
    }
    const unresolvedIds = referenceIds.filter((id) => !sponsorshipMap.has(id));

    if (unresolvedIds.length === 0) return sponsorshipMap;

    const orphans = await this.prisma.orphan.findMany({
      where: { id: { in: unresolvedIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    for (const orphan of orphans) {
      sponsorshipMap.set(orphan.id, orphan);
    }

    return sponsorshipMap;
  }

  private mapTransaction(
    transaction: FinancialRecord,
    aidRequestMap: AidRequestMap,
  ): DonorHistoryItemDto {
    const item = this.mapBaseHistoryItem(transaction);

    if (
      transaction.type === TransactionType.AID_REQUEST_DONATION &&
      transaction.referenceType === REQUEST_AID_REFERENCE_TYPE &&
      transaction.referenceId
    ) {
      const aidRequest = aidRequestMap.get(transaction.referenceId);

      if (aidRequest) {
        item.aidRequest = aidRequest;
      }
    }

    return item;
  }

  private mapWalletTransaction(
    transaction: FinancialRecord,
    aidRequestMap: AidRequestMap,
    orphanMap: OrphanMap,
  ): DonorHistoryItemDto {
    const item = this.mapBaseHistoryItem(transaction);

    if (
      transaction.type === TransactionType.AID_REQUEST_DONATION &&
      transaction.referenceType === REQUEST_AID_REFERENCE_TYPE &&
      transaction.referenceId
    ) {
      const aidRequest = aidRequestMap.get(transaction.referenceId);

      if (aidRequest) {
        item.aidRequest = aidRequest;
      }
    }

    if (
      transaction.type === TransactionType.SPONSORSHIP_DONATION &&
      transaction.referenceId
    ) {
      const orphan = orphanMap.get(transaction.referenceId);

      if (orphan) {
        item.orphan = orphan;
      }
    }

    return item;
  }

  private mapBaseHistoryItem(record: FinancialRecord): DonorHistoryItemDto {
    return {
      amount: new Prisma.Decimal(record.amount).toFixed(2),
      type: record.type,
      createdAt: record.createdAt,
    };
  }

  private parsePositiveInteger(
    value: string | number | undefined,
    defaultValue: number | undefined,
    lang: string,
    options: { messageKey?: string } = {},
  ): number {
    if (value === undefined || value === '') {
      if (defaultValue !== undefined) return defaultValue;
      throw new BadRequestException(
        this.t(options.messageKey ?? 'INVALID_PAGINATION', lang),
      );
    }

    const normalizedValue = String(value).trim();
    const parsed = Number(normalizedValue);

    if (
      !/^\d+$/.test(normalizedValue) ||
      !Number.isSafeInteger(parsed) ||
      parsed <= 0
    ) {
      throw new BadRequestException(
        this.t(options.messageKey ?? 'INVALID_PAGINATION', lang),
      );
    }

    return parsed;
  }

  private parseOptionalBoolean(
    value: string | undefined,
    lang: string,
  ): boolean | undefined {
    if (value === undefined || value === '') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new BadRequestException(this.t('INVALID_IS_SPONSOR', lang));
  }

  private getCurrentYearRange(now = new Date()): { start: Date; end: Date } {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    };
  }

  private t(key: string, lang: string): string {
    return this.i18n.t(`donor.${key}`, { lang });
  }
}
