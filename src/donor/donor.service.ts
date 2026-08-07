import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
  WalletTransactionDirection,
} from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminDonorHistoryResponseDto,
  AdminDonorListResponseDto,
  AdminDonorSponsorshipProfileResponseDto,
  DonorHistoryAidRequestDto,
  DonorHistoryItemDto,
  DonorHistoryOrphanDto,
  MobileDonorHistoryResponseDto,
} from './dto/donor-response.dto';
import { CompletedAidCasesCountResponseDto } from './dto/public-statistics-response.dto';

const REQUEST_AID_REFERENCE_TYPE = 'REQUEST_AID';
const DEFAULT_APP_TIMEZONE = 'Asia/Damascus';

type FinancialRecord = {
  amount: Prisma.Decimal;
  type: TransactionType;
  createdAt: Date;
  referenceType: string | null;
  referenceId: number | null;
};

type AidRequestMap = Map<number, DonorHistoryAidRequestDto>;
type OrphanMap = Map<number, DonorHistoryOrphanDto>;

type DonorUserPayload = {
  id?: number;
  type?: string;
  userType?: string;
};

@Injectable()
export class DonorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  async getCompletedAidCasesCount(): Promise<CompletedAidCasesCountResponseDto> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) as count
      FROM RequestAid
      WHERE status = ${Status.ACCEPTED}
        AND currentPayment >= cost
    `;

    return {
      completed_aid_cases_count: Number(result[0]?.count ?? 0),
    };
  }

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
    ].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

    return {
      success: true,
      message: this.t('HISTORY_FETCH_SUCCESS', lang),
      data,
    };
  }

  async getSponsorshipProfile(
    donorIdInput: string | number,
    lang = 'ar',
  ): Promise<AdminDonorSponsorshipProfileResponseDto> {
    const donorId = this.parsePositiveInteger(donorIdInput, undefined, lang, {
      messageKey: 'INVALID_ID',
    });

    const donor = await this.prisma.donor.findFirst({
      where: { id: donorId, isSponsor: true },
      select: {
        id: true,
        userId: true,
        zipCode: true,
        isSponsor: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            number: true,
            countryCode: true,
            countryName: true,
            gender: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        sponsorships: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
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
              },
            },
          },
        },
      },
    });

    if (!donor) {
      throw new NotFoundException(this.t('SPONSOR_NOT_FOUND', lang));
    }

    return {
      success: true,
      message: this.t('SPONSORSHIP_PROFILE_FETCH_SUCCESS', lang),
      data: {
        donor: {
          donorId: donor.id,
          userId: donor.userId,
          firstName: donor.user.firstName,
          lastName: donor.user.lastName,
          email: donor.user.email,
          number: donor.user.number,
          countryCode: donor.user.countryCode,
          countryName: donor.user.countryName,
          gender: donor.user.gender,
          zipCode: donor.zipCode,
          isSponsor: donor.isSponsor,
          createdAt: donor.user.createdAt,
          updatedAt: donor.user.updatedAt,
        },
        sponsorshipHistory: donor.sponsorships.map((sponsorship) => ({
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
          orphan: sponsorship.orphan,
        })),
      },
    };
  }

  async getMyHistory(
    user: DonorUserPayload,
    lang = 'ar',
  ): Promise<MobileDonorHistoryResponseDto> {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { id: true, userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('AUTHENTICATED_USER_NOT_DONOR', lang));
    }

    const timezone = this.getAppTimezone();
    const { currentYear, previousYear, start, end } =
      this.getCurrentAndPreviousYearRange(timezone);
    const operations = await this.getHistoryItemsForDonor(
      donor.userId,
      start,
      end,
      lang,
    );

    return {
      success: true,
      message: this.t('HISTORY_FETCH_SUCCESS', lang),
      data: {
        years: [
          {
            year: currentYear,
            operations: operations.filter(
              (operation) =>
                this.getYearInTimezone(operation.createdAt, timezone) === currentYear,
            ),
          },
          {
            year: previousYear,
            operations: operations.filter(
              (operation) =>
                this.getYearInTimezone(operation.createdAt, timezone) === previousYear,
            ),
          },
        ],
      },
    };
  }

  private async getHistoryItemsForDonor(
    donorUserId: number,
    start: Date,
    end: Date,
    lang?: string,
  ): Promise<DonorHistoryItemDto[]> {
    const [transactions, wallet] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          donorId: donorUserId,
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
        where: { donorId: donorUserId },
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
    const aidRequestMap = await this.getAidRequestMap(
      [...transactions, ...walletTransactions],
      lang,
    );
    const orphanMap = await this.getOrphanMap(walletTransactions);

    return [
      ...transactions.map((transaction) =>
        this.mapTransaction(transaction, aidRequestMap),
      ),
      ...walletTransactions.map((transaction) =>
        this.mapWalletTransaction(transaction, aidRequestMap, orphanMap),
      ),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  private async getAidRequestMap(
    records: FinancialRecord[],
    lang?: string,
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
          title: lang
            ? this.localizeJsonValue(request.title, lang)
            : request.title,
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

  private getAuthenticatedDonorUserId(
    user: DonorUserPayload,
    lang: string,
  ): number {
    if (!user?.id) {
      throw new UnauthorizedException(this.t('AUTHENTICATION_REQUIRED', lang));
    }

    const userType = user.type ?? user.userType;

    if (userType !== UserType.DONOR) {
      throw new ForbiddenException(this.t('ONLY_DONORS_CAN_VIEW_HISTORY', lang));
    }

    return user.id;
  }

  private getAppTimezone(): string {
    const timezone = this.configService.get<string>('APP_TIMEZONE')?.trim();

    return timezone || DEFAULT_APP_TIMEZONE;
  }

  private getCurrentAndPreviousYearRange(
    timezone: string,
    now = new Date(),
  ): { currentYear: number; previousYear: number; start: Date; end: Date } {
    const currentYear = this.getYearInTimezone(now, timezone);
    const previousYear = currentYear - 1;

    return {
      currentYear,
      previousYear,
      start: this.getZonedYearStart(previousYear, timezone),
      end: this.getZonedYearStart(currentYear + 1, timezone),
    };
  }

  private getYearInTimezone(date: Date, timezone: string): number {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
      }).format(date),
    );
  }

  private getZonedYearStart(year: number, timezone: string): Date {
    const localAsUtc = Date.UTC(year, 0, 1, 0, 0, 0);
    const firstOffset = this.getTimezoneOffsetMs(new Date(localAsUtc), timezone);
    const firstCandidate = new Date(localAsUtc - firstOffset);
    const correctedOffset = this.getTimezoneOffsetMs(firstCandidate, timezone);

    return new Date(localAsUtc - correctedOffset);
  }

  private getTimezoneOffsetMs(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const getPart = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value);
    const zonedTimestamp = Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      getPart('hour'),
      getPart('minute'),
      getPart('second'),
    );

    return zonedTimestamp - date.getTime();
  }

  private t(key: string, lang: string): string {
    return this.i18n.t(`donor.${key}`, { lang });
  }
}
