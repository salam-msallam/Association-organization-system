import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Status, UserType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';

type SupportedLanguage = 'ar' | 'en';

@Injectable()
export class BeneficiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async findAll(status: string | undefined, page = 1, limit = 10, lang = 'ar') {
    const normalizedStatus = this.normalizeStatus(status, lang);
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {
      userType: UserType.BENEFICIARY,
      beneficiary: normalizedStatus
        ? { is: { status: normalizedStatus } }
        : { isNot: null },
    };

    const [beneficiaries, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          beneficiary: {
            select: {
              status: true,
              socialStatus: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      message: this.i18n.t('beneficiary.FETCH_SUCCESS', { lang }),
      data: beneficiaries.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.beneficiary?.status,
        socialStatus: user.beneficiary?.socialStatus,
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

  async findOne(id: number, lang = 'ar') {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        userType: UserType.BENEFICIARY,
        beneficiary: { isNot: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        number: true,
        countryName: true,
        countryCode: true,
        gender: true,
        createdAt: true,
        updatedAt: true,
        beneficiary: {
          select: {
            id: true,
            personalPhoto: true,
            familyStatement: true,
            address: true,
            status: true,
            rejectionReason: true,
            socialStatus: true,
            numberOfChildren: true,
            isUnemployed: true,
            monthlyIncome: true,
          },
        },
      },
    });

    if (!user || !user.beneficiary) {
      throw new NotFoundException(this.i18n.t('beneficiary.NOT_FOUND', { lang }));
    }

    const responseLanguage = this.toSupportedLanguage(lang);

    return {
      success: true,
      message: this.i18n.t('beneficiary.FETCH_ONE_SUCCESS', { lang }),
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        number: user.number,
        countryName: user.countryName,
        countryCode: user.countryCode,
        gender: user.gender,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        beneficiary: {
           ...user.beneficiary,
  monthlyIncome: Number(user.beneficiary.monthlyIncome),
  address: this.translateJsonValue(user.beneficiary.address, responseLanguage),
  rejectionReason: this.translateJsonValue(
    user.beneficiary.rejectionReason,
    responseLanguage,
          ),
        },
      },
    };
  }

  private normalizeStatus(status: string | undefined, lang: string): Status | undefined {
    if (!status) return undefined;

    const normalizedStatus = status.toUpperCase() as Status;
    if (!Object.values(Status).includes(normalizedStatus)) {
      throw new BadRequestException(this.i18n.t('beneficiary.INVALID_STATUS', { lang }));
    }

    return normalizedStatus;
  }

  private translateJsonValue(value: Prisma.JsonValue, lang: SupportedLanguage): unknown {
    if (!value || typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.map((item) => this.translateJsonValue(item, lang));
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if ('ar' in record || 'en' in record) {
      return record[lang] ?? record.ar ?? record.en ?? value;
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [
        key,
        this.translateJsonValue(item, lang),
      ]),
    );
  }

  private toSupportedLanguage(lang: string): SupportedLanguage {
    return lang === 'en' ? 'en' : 'ar';
  }
}
