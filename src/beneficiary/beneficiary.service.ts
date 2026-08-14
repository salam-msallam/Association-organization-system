import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Status, UserType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewBeneficiaryDto } from './dto/review-beneficiary.dto';
import { ReviewBeneficiaryResponseDto } from './dto/review-beneficiary-response.dto';

@Injectable()
export class BeneficiaryService {
  private readonly logger = new Logger(BeneficiaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly notificationsService: NotificationsService,
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
          gender: true,
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
        gender: user.gender,
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
            dateOfBirth: true,
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
      throw new NotFoundException(
        this.i18n.t('beneficiary.NOT_FOUND', { lang }),
      );
    }

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
          dateOfBirth: this.formatNullableDateOnly(
            user.beneficiary.dateOfBirth,
          ),
          monthlyIncome: Number(user.beneficiary.monthlyIncome),
        },
      },
    };
  }

  async reviewStatus(
    userId: number,
    dto: ReviewBeneficiaryDto,
    lang = 'ar',
  ): Promise<ReviewBeneficiaryResponseDto> {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException(
        this.i18n.t('beneficiary.INVALID_ID', { lang }),
      );
    }

    if (dto.status !== Status.ACCEPTED && dto.status !== Status.REJECTED) {
      throw new BadRequestException(
        this.i18n.t('beneficiary.INVALID_REVIEW_STATUS', { lang }),
      );
    }

    if (dto.status === Status.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException(
        this.i18n.t('beneficiary.REJECTION_REASON_REQUIRED', { lang }),
      );
    }

    const account = await this.prisma.user.findFirst({
      where: {
        id: userId,
        userType: UserType.BENEFICIARY,
        beneficiary: { isNot: null },
      },
      select: {
        beneficiary: {
          select: { status: true },
        },
      },
    });

    if (!account?.beneficiary) {
      throw new NotFoundException(
        this.i18n.t('beneficiary.NOT_FOUND', { lang }),
      );
    }

    if (account.beneficiary.status !== Status.PENDING) {
      throw new BadRequestException(
        this.i18n.t('beneficiary.ALREADY_REVIEWED', { lang }),
      );
    }

    const rejectionReason =
      dto.status === Status.REJECTED
        ? (dto.rejectionReason as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;

    const result = await this.prisma.beneficiary.updateMany({
      where: {
        userId,
        status: Status.PENDING,
      },
      data: {
        status: dto.status,
        rejectionReason,
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException(
        this.i18n.t('beneficiary.ALREADY_REVIEWED', { lang }),
      );
    }

    if (dto.status === Status.ACCEPTED) {
      await this.notifyAccountAccepted(userId);
    }

    if (dto.status === Status.REJECTED) {
      await this.notifyAccountRejected(userId, dto.rejectionReason!);
    }

    return {
      success: true,
      message: this.i18n.t('beneficiary.STATUS_UPDATE_SUCCESS', { lang }),
      data: {
        id: userId,
        status: dto.status,
        rejectionReason:
          dto.status === Status.REJECTED ? dto.rejectionReason! : null,
      },
    };
  }

  private async notifyAccountAccepted(userId: number): Promise<void> {
    try {
      await this.notificationsService.createAndSend({
        userId,
        title: {
          ar: 'تم قبول حسابك',
          en: 'Your account has been accepted',
        },
        message: {
          ar: 'تم قبول حسابك كمستفيد، يمكنك الآن تسجيل الدخول.',
          en: 'Your beneficiary account has been accepted. You can now sign in.',
        },
        targetType: 'BENEFICIARY_ACCOUNT',
        targetId: userId,
      });
    } catch {
      this.logger.warn(
        `Failed to create the beneficiary acceptance notification for user ${userId}`,
      );
    }
  }

  private async notifyAccountRejected(
    userId: number,
    rejectionReason: { ar: string; en: string },
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSend({
        userId,
        title: {
          ar: 'تم رفض حسابك',
          en: 'Your account has been rejected',
        },
        message: {
          ar: `تم رفض حسابك كمستفيد. لأن: ${rejectionReason.ar}`,
          en: `Your beneficiary account has been rejected. because ${rejectionReason.en}`,
        },
        targetType: 'BENEFICIARY_ACCOUNT',
        targetId: userId,
      });
    } catch {
      this.logger.warn(
        `Failed to create the beneficiary rejection notification for user ${userId}`,
      );
    }
  }

  private normalizeStatus(
    status: string | undefined,
    lang: string,
  ): Status | undefined {
    if (!status) return undefined;

    const normalizedStatus = status.toUpperCase() as Status;
    if (!Object.values(Status).includes(normalizedStatus)) {
      throw new BadRequestException(
        this.i18n.t('beneficiary.INVALID_STATUS', { lang }),
      );
    }

    return normalizedStatus;
  }

  private formatNullableDateOnly(date: Date | null): string | null {
    return date ? date.toISOString().slice(0, 10) : null;
  }
}
