import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CancellationSource,
  Gender,
  OrphanEmergencyCoverageReason,
  Prisma,
  Status,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewSponsorshipDto } from './dto/review-sponsorship.dto';
import {
  getFirstSponsorshipCoveredMonth,
  getPaidSponsorshipMonths,
  getPreviousRenewalWindow,
  getSponsorshipReminderContext,
  type SponsorshipReminderStage,
  SPONSORSHIP_TIME_ZONE,
  toSponsorshipDatabaseDate,
} from './sponsorship-billing-period';
import { SponsorshipFundService } from './sponsorship-fund.service';

const MONTHLY_SPONSORSHIP_AMOUNT = new Prisma.Decimal(10);
const MINIMUM_COVERAGE_MONTHS = 3;
const REQUIRED_BALANCE_PER_SPONSORSHIP = MONTHLY_SPONSORSHIP_AMOUNT.times(
  MINIMUM_COVERAGE_MONTHS,
);
const SPONSORSHIP_REFERENCE_TYPE = 'SPONSORSHIP';

type SponsorshipUserPayload = {
  id?: number;
  type?: string;
  userType?: string;
};

type AdminSponsorshipOrphanSummary = {
  id: number;
  firstName: string;
  lastName: string;
  priority: number;
};

type AdminSponsorshipOrphanDetails = AdminSponsorshipOrphanSummary & {
  fatherName: string;
  motherName: string;
  birthOfDate: Date;
  gender: Gender;
  class: Prisma.JsonValue;
  Diseases: Prisma.JsonValue;
  FamilyStatement: string;
  brotherAndSisterNumber: number;
  guardianName: string;
  guaranteedPhone: string;
  bodySize: number;
  shoesSize: number;
  currentAddress: Prisma.JsonValue;
  previousAddress: Prisma.JsonValue;
  talent: Prisma.JsonValue;
  isSupported: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AdminSponsorshipRecord<TOrphan> = {
  id: number;
  amount: Prisma.Decimal;
  status: Status;
  rejectionReason: Prisma.JsonValue | null;
  startDate: Date | null;
  endDate: Date | null;
  cancellationSource: CancellationSource | null;
  createdAt: Date;
  donor: {
    id: number;
    userId: number;
    user: {
      firstName: string;
      lastName: string;
      email: string;
      number: string;
    };
  };
  orphan: TOrphan;
};

@Injectable()
export class SponsorshipService {
  private readonly logger = new Logger(SponsorshipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly sponsorshipFundService: SponsorshipFundService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRequest(user: SponsorshipUserPayload, lang = 'ar') {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { id: true, userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM Wallet
        WHERE donorId = ${donorUserId}
        FOR UPDATE
      `;

      const wallet = await tx.wallet.findUnique({
        where: { donorId: donorUserId },
        select: { runningBalance: true },
      });
      const walletBalance = new Prisma.Decimal(wallet?.runningBalance ?? 0);

      const coveredSponsorshipCount = await tx.sponsorship.count({
        where: {
          donorId: donor.id,
          status: { in: [Status.PENDING, Status.ACCEPTED] },
        },
      });
      const requiredWalletBalance = REQUIRED_BALANCE_PER_SPONSORSHIP.times(
        coveredSponsorshipCount + 1,
      );

      if (walletBalance.lt(requiredWalletBalance)) {
        throw new BadRequestException(
          this.t('INSUFFICIENT_WALLET_BALANCE', lang, {
            walletBalance: walletBalance.toFixed(2),
            requiredBalance: requiredWalletBalance.toFixed(2),
          }),
        );
      }

      const sponsorship = await tx.sponsorship.create({
        data: {
          donorId: donor.id,
          amount: MONTHLY_SPONSORSHIP_AMOUNT,
          status: Status.PENDING,
        },
        select: {
          id: true,
          donorId: true,
          amount: true,
          status: true,
          orphanId: true,
          employeeId: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        message: this.t('REQUEST_CREATED', lang),
        data: {
          id: sponsorship.id,
          donorId: sponsorship.donorId,
          monthlyAmount: sponsorship.amount.toFixed(2),
          status: sponsorship.status,
          orphanId: sponsorship.orphanId,
          employeeId: sponsorship.employeeId,
          requiredWalletBalance: requiredWalletBalance.toFixed(2),
          walletBalance: walletBalance.toFixed(2),
          createdAt: sponsorship.createdAt,
        },
      };
    });

    await this.notifyStaffAboutPendingSponsorship(result.data.id);

    return result;
  }

  private async notifyStaffAboutPendingSponsorship(
    sponsorshipId: number,
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSendToPermission(
        'status:sponsorships',
        {
          title: {
            ar: 'طلب كفالة جديد بانتظار المراجعة',
            en: 'New sponsorship request awaiting review',
          },
          message: {
            ar: 'تم تقديم طلب كفالة جديد ويحتاج إلى المراجعة.',
            en: 'A new sponsorship request has been submitted and requires review.',
          },
          targetType: 'SPONSORSHIP_REVIEW',
          targetId: sponsorshipId,
        },
      );
    } catch {
      this.logger.warn(
        `Failed to notify staff about pending sponsorship ${sponsorshipId}`,
      );
    }
  }

  async findMine(user: SponsorshipUserPayload, status?: string, lang = 'ar') {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);
    const normalizedStatus = this.normalizeStatus(status, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { id: true, userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    const sponsorships = await this.prisma.sponsorship.findMany({
      where: {
        donorId: donor.id,
        ...(normalizedStatus && { status: normalizedStatus }),
      },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        donorId: true,
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
            birthOfDate: true,
            gender: true,
            class: true,
            talent: true,
          },
        },
      },
    });

    return {
      success: true,
      message: this.t('FETCH_SUCCESS', lang),
      data: sponsorships.map((sponsorship) => ({
        id: sponsorship.id,
        donorId: sponsorship.donorId,
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
        orphan: sponsorship.orphan
          ? {
              ...sponsorship.orphan,
              class: this.localizeJsonValue(sponsorship.orphan.class, lang),
              talent: this.localizeJsonValue(sponsorship.orphan.talent, lang),
            }
          : null,
      })),
    };
  }

  async findOrphanSummary(
    sponsorshipId: number,
    user: SponsorshipUserPayload,
    lang = 'ar',
  ) {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);
    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { id: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    const sponsorship = await this.prisma.sponsorship.findFirst({
      where: {
        id: sponsorshipId,
        donorId: donor.id,
        status: Status.ACCEPTED,
      },
      select: {
        id: true,
        orphan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthOfDate: true,
            gender: true,
            class: true,
            talent: true,
            Diseases: true,
          },
        },
      },
    });

    if (!sponsorship) {
      throw new NotFoundException(this.t('NOT_FOUND', lang));
    }

    if (!sponsorship.orphan) {
      throw new NotFoundException(this.t('ORPHAN_NOT_ASSIGNED', lang));
    }

    const firstPayment = await this.prisma.walletTransaction.findFirst({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: SPONSORSHIP_REFERENCE_TYPE,
        referenceId: sponsorship.id,
      },
      select: { id: true },
    });

    if (!firstPayment) {
      throw new ForbiddenException(
        this.t('ORPHAN_SUMMARY_PAYMENT_REQUIRED', lang),
      );
    }

    return {
      success: true,
      message: this.t('ORPHAN_SUMMARY_FETCH_SUCCESS', lang),
      data: {
        sponsorshipId: sponsorship.id,
        orphan: {
          id: sponsorship.orphan.id,
          firstName: sponsorship.orphan.firstName,
          lastName: sponsorship.orphan.lastName,
          birthOfDate: sponsorship.orphan.birthOfDate,
          gender: sponsorship.orphan.gender,
          class: this.localizeJsonValue(sponsorship.orphan.class, lang),
          talent: this.localizeJsonValue(sponsorship.orphan.talent, lang),
          diseases: this.localizeJsonValue(sponsorship.orphan.Diseases, lang),
        },
      },
    };
  }

  async findAllForStaff(
    status?: string,
    lang = 'ar',
    pageInput?: string,
    limitInput?: string,
  ) {
    const normalizedStatus = this.normalizeStatus(status, lang);
    const page = this.parsePositiveInteger(pageInput, 1, lang);
    const limit = this.parsePositiveInteger(limitInput, 10, lang);
    const skip = (page - 1) * limit;
    const where: Prisma.SponsorshipWhereInput = normalizedStatus
      ? { status: normalizedStatus }
      : {};

    const [sponsorships, totalCount] = await Promise.all([
      this.prisma.sponsorship.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          rejectionReason: true,
          startDate: true,
          endDate: true,
          cancellationSource: true,
          createdAt: true,
          donor: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  number: true,
                },
              },
            },
          },
          orphan: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              priority: true,
            },
          },
        },
      }),
      this.prisma.sponsorship.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      message: this.t('ADMIN_FETCH_SUCCESS', lang),
      data: sponsorships.map((sponsorship) =>
        this.toAdminSponsorshipResponse(sponsorship, lang),
      ),
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

  async findOneForStaff(sponsorshipId: number, lang = 'ar') {
    const sponsorship = await this.prisma.sponsorship.findUnique({
      where: { id: sponsorshipId },
      select: {
        id: true,
        amount: true,
        status: true,
        rejectionReason: true,
        startDate: true,
        endDate: true,
        cancellationSource: true,
        createdAt: true,
        donor: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                number: true,
              },
            },
          },
        },
        orphan: true,
      },
    });

    if (!sponsorship) {
      throw new NotFoundException(this.t('NOT_FOUND', lang));
    }

    return {
      success: true,
      message: this.t('ADMIN_FETCH_ONE_SUCCESS', lang),
      data: this.toAdminSponsorshipDetailResponse(sponsorship, lang),
    };
  }

  async reviewStatus(
    sponsorshipId: number,
    staffUserId: number,
    dto: ReviewSponsorshipDto,
    lang = 'ar',
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM Sponsorship
        WHERE id = ${sponsorshipId}
        FOR UPDATE
      `;

      const sponsorship = await tx.sponsorship.findUnique({
        where: { id: sponsorshipId },
        select: { id: true, donorId: true, status: true },
      });

      if (!sponsorship) {
        throw new NotFoundException(this.t('NOT_FOUND', lang));
      }

      if (sponsorship.status !== Status.PENDING) {
        throw new BadRequestException(this.t('ALREADY_REVIEWED', lang));
      }

      const employee = await tx.employee.findUnique({
        where: { userId: staffUserId },
        select: { id: true },
      });

      if (dto.status === Status.ACCEPTED) {
        await tx.$queryRaw`
          SELECT id
          FROM Orphan
          WHERE id = ${dto.orphanId}
          FOR UPDATE
        `;

        const orphan = await tx.orphan.findUnique({
          where: { id: dto.orphanId },
          select: { id: true },
        });

        if (!orphan) {
          throw new BadRequestException(this.t('ORPHAN_NOT_FOUND', lang));
        }

        const duplicateSponsorship = await tx.sponsorship.findFirst({
          where: {
            donorId: sponsorship.donorId,
            orphanId: dto.orphanId,
            status: Status.ACCEPTED,
          },
          select: { id: true },
        });

        if (duplicateSponsorship) {
          throw new BadRequestException(
            this.t('DONOR_ALREADY_SPONSORS_ORPHAN', lang),
          );
        }

        const sponsorshipUpdate = await tx.sponsorship.updateMany({
          where: { id: sponsorship.id, status: Status.PENDING },
          data: {
            status: Status.ACCEPTED,
            orphanId: dto.orphanId,
            employeeId: employee?.id ?? null,
            startDate: toSponsorshipDatabaseDate(),
            rejectionReason: Prisma.DbNull,
          },
        });

        if (sponsorshipUpdate.count !== 1) {
          throw new BadRequestException(this.t('REVIEW_STATE_CHANGED', lang));
        }

        await tx.orphan.update({
          where: { id: dto.orphanId },
          data: { isSupported: true },
        });

        await tx.donor.update({
          where: { id: sponsorship.donorId },
          data: { isSponsor: true },
        });

        await this.sponsorshipFundService.stopActiveCoveragesForOrphan(
          tx,
          dto.orphanId!,
          new Date(),
        );
      } else {
        const sponsorshipUpdate = await tx.sponsorship.updateMany({
          where: { id: sponsorship.id, status: Status.PENDING },
          data: {
            status: Status.REJECTED,
            employeeId: employee?.id ?? null,
            rejectionReason: {
              ar: dto.rejectionReason!.ar,
              en: dto.rejectionReason!.en,
            },
          },
        });

        if (sponsorshipUpdate.count !== 1) {
          throw new BadRequestException(this.t('REVIEW_STATE_CHANGED', lang));
        }
      }

      const reviewed = await tx.sponsorship.findUnique({
        where: { id: sponsorship.id },
        select: {
          id: true,
          amount: true,
          status: true,
          rejectionReason: true,
          startDate: true,
          endDate: true,
          cancellationSource: true,
          createdAt: true,
          donor: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  number: true,
                },
              },
            },
          },
          orphan: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              priority: true,
            },
          },
        },
      });

      if (!reviewed) {
        throw new NotFoundException(this.t('NOT_FOUND', lang));
      }

      return {
        response: {
          success: true,
          message: this.t(
            dto.status === Status.ACCEPTED
              ? 'ACCEPT_SUCCESS'
              : 'REJECT_SUCCESS',
            lang,
          ),
          data: this.toAdminSponsorshipResponse(reviewed, lang),
        },
        donorUserId: reviewed.donor.userId,
        startDate: reviewed.startDate,
      };
    });

    if (dto.status === Status.ACCEPTED) {
      await this.notifySponsorshipAccepted(
        result.donorUserId,
        sponsorshipId,
        result.startDate!,
      );
    }

    if (dto.status === Status.REJECTED) {
      await this.notifySponsorshipRejected(
        result.donorUserId,
        sponsorshipId,
        dto.rejectionReason!,
      );
    }

    return result.response;
  }

  private async notifySponsorshipAccepted(
    donorUserId: number,
    sponsorshipId: number,
    startDate: Date,
  ): Promise<void> {
    const coveredMonth = getFirstSponsorshipCoveredMonth(startDate);

    try {
      await this.notificationsService.createAndSend({
        userId: donorUserId,
        title: {
          ar: 'تم قبول طلب الكفالة',
          en: 'Your sponsorship request has been accepted',
        },
        message: {
          ar: `تم قبول طلب الكفالة الخاص بك. يرجى دفع الدفعة الأولى المستحقة لشهر ${coveredMonth}.`,
          en: `Your sponsorship request has been accepted. Please pay the first installment due for ${coveredMonth}.`,
        },
        targetType: 'SPONSORSHIP',
        targetId: sponsorshipId,
        additionalData: {
          sponsorshipId: String(sponsorshipId),
          coveredMonth,
        },
      });
    } catch {
      this.logger.warn(
        `Failed to create the sponsorship acceptance notification for sponsorship ${sponsorshipId}`,
      );
    }
  }

  private async notifySponsorshipRejected(
    donorUserId: number,
    sponsorshipId: number,
    rejectionReason: { ar: string; en: string },
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSend({
        userId: donorUserId,
        title: {
          ar: 'تم رفض طلب الكفالة',
          en: 'Your sponsorship request has been rejected',
        },
        message: {
          ar: `تم رفض طلب الكفالة الخاص بك. لأن: ${rejectionReason.ar}`,
          en: `Your sponsorship request has been rejected. because ${rejectionReason.en}`,
        },
        targetType: 'SPONSORSHIP',
        targetId: sponsorshipId,
      });
    } catch {
      this.logger.warn(
        `Failed to create the sponsorship rejection notification for sponsorship ${sponsorshipId}`,
      );
    }
  }

  async cancel(
    sponsorshipId: number,
    user: SponsorshipUserPayload,
    lang = 'ar',
  ) {
    const donorUserId = this.getAuthenticatedDonorUserId(user, lang);

    const donor = await this.prisma.donor.findUnique({
      where: { userId: donorUserId },
      select: { id: true, userId: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const sponsorship = await tx.sponsorship.findFirst({
        where: { id: sponsorshipId, donorId: donor.id },
        select: {
          id: true,
          donorId: true,
          status: true,
          orphanId: true,
          amount: true,
          startDate: true,
        },
      });

      if (!sponsorship) {
        throw new NotFoundException(this.t('NOT_FOUND', lang));
      }

      if (sponsorship.status === Status.CANCELLED) {
        throw new BadRequestException(this.t('ALREADY_CANCELLED', lang));
      }

      if (
        sponsorship.status !== Status.PENDING &&
        sponsorship.status !== Status.ACCEPTED
      ) {
        throw new BadRequestException(this.t('CANCELLATION_NOT_ALLOWED', lang));
      }

      const wasAccepted = sponsorship.status === Status.ACCEPTED;
      const endDate = new Date();
      const updateResult = await tx.sponsorship.updateMany({
        where: {
          id: sponsorship.id,
          donorId: donor.id,
          status: sponsorship.status,
        },
        data: {
          status: Status.CANCELLED,
          endDate,
          cancellationSource: CancellationSource.DONOR,
        },
      });

      if (updateResult.count !== 1) {
        throw new BadRequestException(
          this.t('CANCELLATION_STATE_CHANGED', lang),
        );
      }

      let orphanReleased = false;

      if (wasAccepted) {
        orphanReleased = await this.releaseAcceptedSponsorshipRelations(
          tx,
          sponsorship,
        );

        await this.sponsorshipFundService.createEmergencyCoverageIfEligible(
          tx,
          sponsorship,
          OrphanEmergencyCoverageReason.SPONSOR_CANCELLED,
          endDate,
        );
      }

      const cancelledSponsorship = await tx.sponsorship.findUnique({
        where: { id: sponsorship.id },
        select: {
          id: true,
          donorId: true,
          orphanId: true,
          status: true,
          startDate: true,
          endDate: true,
          cancellationSource: true,
        },
      });

      return {
        response: {
          success: true,
          message: this.t('CANCEL_SUCCESS', lang),
          data: {
            ...cancelledSponsorship,
            orphanReleased,
          },
        },
        wasAccepted,
      };
    });

    if (result.wasAccepted) {
      await this.notifyStaffAboutAcceptedSponsorshipCancellation(sponsorshipId);
    }

    return result.response;
  }

  private async notifyStaffAboutAcceptedSponsorshipCancellation(
    sponsorshipId: number,
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSendToPermission(
        'status:sponsorships',
        {
          title: {
            ar: 'إلغاء كفالة من قبل المتبرع',
            en: 'Accepted sponsorship cancelled by donor',
          },
          message: {
            ar: 'قام المتبرع بإلغاء كفالته يرجى مراجعة تفاصيل الكفالة.',
            en: 'A donor cancelled an accepted sponsorship. Please review the sponsorship details.',
          },
          targetType: 'ACCEPTED_SPONSORSHIP_CANCELLED',
          targetId: sponsorshipId,
        },
      );
    } catch {
      this.logger.warn(
        `Failed to notify staff about donor cancellation of accepted sponsorship ${sponsorshipId}`,
      );
    }
  }

  @Cron('0 9 * * *', { timeZone: SPONSORSHIP_TIME_ZONE })
  async handleSponsorshipPaymentReminders(): Promise<void> {
    try {
      const notificationCount = await this.sendSponsorshipPaymentReminders();

      if (notificationCount > 0) {
        this.logger.log(
          `Created ${notificationCount} sponsorship payment reminder(s).`,
        );
      }
    } catch (error) {
      this.logger.error('Sponsorship payment reminders failed.', error);
    }
  }

  async sendSponsorshipPaymentReminders(now = new Date()): Promise<number> {
    const reminder = getSponsorshipReminderContext(now);
    if (!reminder) return 0;

    const sponsorships = await this.prisma.sponsorship.findMany({
      where: {
        status: Status.ACCEPTED,
        startDate: { not: null },
      },
      select: {
        id: true,
        startDate: true,
        donor: { select: { userId: true } },
      },
    });

    if (sponsorships.length === 0) return 0;

    const sponsorshipIds = sponsorships.map(({ id }) => id);
    const payments = await this.prisma.walletTransaction.findMany({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: SPONSORSHIP_REFERENCE_TYPE,
        referenceId: { in: sponsorshipIds },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        referenceId: true,
        coveredMonth: true,
        createdAt: true,
      },
    });
    const paymentsBySponsorship = new Map<
      number,
      { coveredMonth: string | null; createdAt: Date }[]
    >();

    for (const payment of payments) {
      if (payment.referenceId === null) continue;
      const sponsorshipPayments =
        paymentsBySponsorship.get(payment.referenceId) ?? [];
      sponsorshipPayments.push(payment);
      paymentsBySponsorship.set(payment.referenceId, sponsorshipPayments);
    }

    let notificationCount = 0;

    for (const sponsorship of sponsorships) {
      if (!sponsorship.startDate) continue;

      const paidMonths = getPaidSponsorshipMonths(
        sponsorship.startDate,
        paymentsBySponsorship.get(sponsorship.id) ?? [],
      );
      const firstCoveredMonth = getFirstSponsorshipCoveredMonth(
        sponsorship.startDate,
      );
      const coveredMonth = paidMonths.has(firstCoveredMonth)
        ? reminder.coveredMonth
        : firstCoveredMonth;

      if (
        coveredMonth > reminder.coveredMonth ||
        paidMonths.has(coveredMonth)
      ) {
        continue;
      }

      const targetType = this.getPaymentReminderTargetType(reminder.stage);
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          userId: sponsorship.donor.userId,
          targetType,
          targetId: sponsorship.id,
          createdAt: { gte: reminder.notificationDayStart },
        },
        select: { id: true },
      });

      if (existingNotification) continue;

      const created = await this.notifySponsorshipPaymentReminder(
        sponsorship.donor.userId,
        sponsorship.id,
        coveredMonth,
        reminder.stage,
      );

      if (created) notificationCount += 1;
    }

    return notificationCount;
  }

  private getPaymentReminderTargetType(
    stage: SponsorshipReminderStage,
  ): string {
    return `SPONSORSHIP_PAYMENT_REMINDER_${stage}`;
  }

  private async notifySponsorshipPaymentReminder(
    donorUserId: number,
    sponsorshipId: number,
    coveredMonth: string,
    stage: SponsorshipReminderStage,
  ): Promise<boolean> {
    const copy = {
      DAY_20: {
        arTitle: 'موعد دفع الكفالة',
        enTitle: 'Sponsorship payment is due',
        arMessage: `يرجى دفع دفعة الكفالة المستحقة لشهر ${coveredMonth}.`,
        enMessage: `Please pay the sponsorship installment due for ${coveredMonth}.`,
      },
      DAY_25: {
        arTitle: 'تذكير بدفع الكفالة',
        enTitle: 'Sponsorship payment reminder',
        arMessage: `لم تُدفع دفعة الكفالة المستحقة لشهر ${coveredMonth} بعد. يرجى دفعها قبل نهاية الشهر.`,
        enMessage: `The sponsorship installment due for ${coveredMonth} has not been paid yet. Please pay it before month-end.`,
      },
      FINAL_DAY: {
        arTitle: 'التذكير الأخير بدفع الكفالة',
        enTitle: 'Final sponsorship payment reminder',
        arMessage: `هذا هو التذكير الأخير لدفع كفالة شهر ${coveredMonth}. ستُلغى الكفالة تلقائياً عند بدء الشهر الجديد إذا لم يتم الدفع.`,
        enMessage: `This is the final reminder to pay the ${coveredMonth} sponsorship installment. The sponsorship will be cancelled automatically when the new month starts if it remains unpaid.`,
      },
    }[stage];

    try {
      await this.notificationsService.createAndSend({
        userId: donorUserId,
        title: { ar: copy.arTitle, en: copy.enTitle },
        message: { ar: copy.arMessage, en: copy.enMessage },
        targetType: this.getPaymentReminderTargetType(stage),
        targetId: sponsorshipId,
        additionalData: {
          sponsorshipId: String(sponsorshipId),
          coveredMonth,
          reminderStage: stage,
        },
      });
      return true;
    } catch {
      this.logger.warn(
        `Failed to create ${stage} payment reminder for sponsorship ${sponsorshipId}`,
      );
      return false;
    }
  }

  @Cron('5 0 * * *', { timeZone: SPONSORSHIP_TIME_ZONE })
  async handleAutomaticCancellation(): Promise<void> {
    try {
      const cancelledCount = await this.cancelOverdueSponsorships();

      if (cancelledCount > 0) {
        this.logger.log(
          `Automatically cancelled ${cancelledCount} overdue sponsorship(s).`,
        );
      }
    } catch (error) {
      this.logger.error('Automatic sponsorship cancellation failed.', error);
    }
  }

  async cancelOverdueSponsorships(now = new Date()): Promise<number> {
    const window = getPreviousRenewalWindow(now);
    const candidates = await this.prisma.sponsorship.findMany({
      where: {
        status: Status.ACCEPTED,
        startDate: { lt: window.databaseCurrentMonthStart },
      },
      select: { id: true, startDate: true },
    });

    if (candidates.length === 0) return 0;

    const candidateIds = candidates.map(({ id }) => id);
    const payments = await this.prisma.walletTransaction.findMany({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: SPONSORSHIP_REFERENCE_TYPE,
        referenceId: { in: candidateIds },
      },
      orderBy: { createdAt: 'asc' },
      select: { referenceId: true, coveredMonth: true, createdAt: true },
    });
    const paymentsBySponsorship = new Map<
      number,
      { coveredMonth: string | null; createdAt: Date }[]
    >();

    for (const payment of payments) {
      if (payment.referenceId === null) continue;
      const sponsorshipPayments =
        paymentsBySponsorship.get(payment.referenceId) ?? [];
      sponsorshipPayments.push(payment);
      paymentsBySponsorship.set(payment.referenceId, sponsorshipPayments);
    }

    const overdueIds = candidates.flatMap((sponsorship) => {
      if (!sponsorship.startDate) return [];
      const paidMonths = getPaidSponsorshipMonths(
        sponsorship.startDate,
        paymentsBySponsorship.get(sponsorship.id) ?? [],
      );
      return paidMonths.has(window.coveredMonth) ? [] : [sponsorship.id];
    });

    let cancelledCount = 0;

    for (const sponsorshipId of overdueIds) {
      const cancelled = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM Sponsorship
          WHERE id = ${sponsorshipId}
          FOR UPDATE
        `;

        const sponsorship = await tx.sponsorship.findFirst({
          where: {
            id: sponsorshipId,
            status: Status.ACCEPTED,
            startDate: { lt: window.databaseCurrentMonthStart },
          },
          select: {
            id: true,
            donorId: true,
            donor: { select: { userId: true } },
            orphanId: true,
            amount: true,
            status: true,
            startDate: true,
          },
        });

        if (!sponsorship) return null;

        if (!sponsorship.startDate) return null;

        const sponsorshipPayments = await tx.walletTransaction.findMany({
          where: {
            type: TransactionType.SPONSORSHIP_DONATION,
            direction: WalletTransactionDirection.DEBIT,
            referenceType: SPONSORSHIP_REFERENCE_TYPE,
            referenceId: sponsorship.id,
          },
          orderBy: { createdAt: 'asc' },
          select: { coveredMonth: true, createdAt: true },
        });

        const paidMonths = getPaidSponsorshipMonths(
          sponsorship.startDate,
          sponsorshipPayments,
        );

        if (paidMonths.has(window.coveredMonth)) return null;

        const updateResult = await tx.sponsorship.updateMany({
          where: { id: sponsorship.id, status: Status.ACCEPTED },
          data: {
            status: Status.CANCELLED,
            endDate: now,
            cancellationSource: CancellationSource.AUTOMATIC,
          },
        });

        if (updateResult.count !== 1) return null;

        await this.releaseAcceptedSponsorshipRelations(tx, sponsorship);
        await this.sponsorshipFundService.createEmergencyCoverageIfEligible(
          tx,
          sponsorship,
          OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
          now,
        );
        return { donorUserId: sponsorship.donor.userId };
      });

      if (cancelled) {
        cancelledCount += 1;
        await this.notifyAutomaticSponsorshipCancellation(
          cancelled.donorUserId,
          sponsorshipId,
        );
        await this.notifyStaffAboutAutomaticSponsorshipCancellation(
          sponsorshipId,
        );
      }
    }

    return cancelledCount;
  }

  private async notifyAutomaticSponsorshipCancellation(
    donorUserId: number,
    sponsorshipId: number,
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSend({
        userId: donorUserId,
        title: {
          ar: 'تم إلغاء الكفالة تلقائياً',
          en: 'Your sponsorship has been automatically cancelled',
        },
        message: {
          ar: 'تم إلغاء كفالتك تلقائياً بسبب عدم دفع المبلغ المستحق.',
          en: 'Your sponsorship was automatically cancelled because the required payment was not made.',
        },
        targetType: 'SPONSORSHIP',
        targetId: sponsorshipId,
      });
    } catch {
      this.logger.warn(
        `Failed to create the automatic cancellation notification for sponsorship ${sponsorshipId}`,
      );
    }
  }

  private async notifyStaffAboutAutomaticSponsorshipCancellation(
    sponsorshipId: number,
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSendToPermission(
        'status:sponsorships',
        {
          title: {
            ar: 'إلغاء كفالة تلقائياً بسبب عدم الدفع',
            en: 'Sponsorship automatically cancelled for non-payment',
          },
          message: {
            ar: 'تم إلغاء كفالة تلقائياً بسبب عدم دفع المبلغ المستحق، يرجى مراجعة تفاصيل الكفالة.',
            en: 'A sponsorship was automatically cancelled because the required payment was not made. Please review its details.',
          },
          targetType: 'AUTOMATIC_SPONSORSHIP_CANCELLED',
          targetId: sponsorshipId,
        },
      );
    } catch {
      this.logger.warn(
        `Failed to notify staff about automatic cancellation of sponsorship ${sponsorshipId}`,
      );
    }
  }

  private async releaseAcceptedSponsorshipRelations(
    tx: Prisma.TransactionClient,
    sponsorship: { id: number; donorId: number; orphanId: number | null },
  ): Promise<boolean> {
    let orphanReleased = false;

    if (sponsorship.orphanId) {
      const otherAcceptedSponsorships = await tx.sponsorship.count({
        where: {
          id: { not: sponsorship.id },
          orphanId: sponsorship.orphanId,
          status: Status.ACCEPTED,
        },
      });

      if (otherAcceptedSponsorships === 0) {
        await tx.orphan.update({
          where: { id: sponsorship.orphanId },
          data: { isSupported: false },
        });
        orphanReleased = true;
      }
    }

    const remainingAcceptedSponsorships = await tx.sponsorship.count({
      where: { donorId: sponsorship.donorId, status: Status.ACCEPTED },
    });

    if (remainingAcceptedSponsorships === 0) {
      await tx.donor.update({
        where: { id: sponsorship.donorId },
        data: { isSponsor: false },
      });
    }

    return orphanReleased;
  }

  private toAdminSponsorshipResponse(
    sponsorship: AdminSponsorshipRecord<AdminSponsorshipOrphanSummary | null>,
    lang: string,
  ) {
    return {
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
      donor: {
        id: sponsorship.donor.id,
        firstName: sponsorship.donor.user.firstName,
        lastName: sponsorship.donor.user.lastName,
        email: sponsorship.donor.user.email,
        number: sponsorship.donor.user.number,
      },
      orphan: sponsorship.orphan,
    };
  }

  private toAdminSponsorshipDetailResponse(
    sponsorship: AdminSponsorshipRecord<AdminSponsorshipOrphanDetails | null>,
    lang: string,
  ) {
    return {
      ...this.toAdminSponsorshipResponse(sponsorship, lang),
      orphan: sponsorship.orphan
        ? {
            ...sponsorship.orphan,
            class: this.localizeJsonValue(sponsorship.orphan.class, lang),
            Diseases: this.localizeJsonValue(sponsorship.orphan.Diseases, lang),
            currentAddress: this.localizeJsonValue(
              sponsorship.orphan.currentAddress,
              lang,
            ),
            previousAddress: this.localizeJsonValue(
              sponsorship.orphan.previousAddress,
              lang,
            ),
            talent: this.localizeJsonValue(sponsorship.orphan.talent, lang),
          }
        : null,
    };
  }

  private getAuthenticatedDonorUserId(
    user: SponsorshipUserPayload,
    lang: string,
  ): number {
    if (!user?.id) {
      throw new UnauthorizedException(this.t('AUTHENTICATION_REQUIRED', lang));
    }

    const userType = user.type ?? user.userType;
    if (userType !== UserType.DONOR) {
      throw new ForbiddenException(this.t('ONLY_DONORS_CAN_APPLY', lang));
    }

    return user.id;
  }

  private normalizeStatus(
    status: string | undefined,
    lang: string,
  ): Status | undefined {
    if (!status) return undefined;

    const normalizedStatus = status.toUpperCase() as Status;
    if (!Object.values(Status).includes(normalizedStatus)) {
      throw new BadRequestException(this.t('INVALID_STATUS', lang));
    }

    return normalizedStatus;
  }

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
    lang: string,
  ): number {
    if (value === undefined || value === '') return defaultValue;

    const normalizedValue = value.trim();
    const parsed = Number(normalizedValue);

    if (
      !/^\d+$/.test(normalizedValue) ||
      !Number.isSafeInteger(parsed) ||
      parsed <= 0
    ) {
      throw new BadRequestException(this.t('INVALID_PAGINATION', lang));
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

  private t(
    key: string,
    lang: string,
    args?: Record<string, string | number>,
  ): string {
    return this.i18n.t(`sponsorship.${key}`, { lang, args });
  }
}
