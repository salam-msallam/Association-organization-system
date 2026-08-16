import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Status,
  TransactionType,
  UserType,
  WalletTransactionDirection,
} from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { I18nService } from 'nestjs-i18n';
import { unlink } from 'node:fs/promises';
import { toPublicUploadPath } from '../interceptors/upload-storage.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SPONSORSHIP_TIME_ZONE } from '../sponsorship/sponsorship-billing-period';
import { CreateAnnualReportResponseDto } from './dto/create-annual-report-response.dto';
import { DonorAnnualReportsResponseDto } from './dto/donor-annual-reports-response.dto';

const SPONSORSHIP_REFERENCE_TYPE = 'SPONSORSHIP';

interface AnnualReportFiles {
  reportImageAr?: Express.Multer.File[];
  reportImageEn?: Express.Multer.File[];
}

interface AnnualReportDonorPayload {
  id?: number;
  type?: string;
  userType?: string;
}

interface AnnualReportCreationResult {
  response: CreateAnnualReportResponseDto;
  donorUserId: number;
  reportId: number;
  sponsorshipId: number;
}

@Injectable()
export class AnnualReportService {
  private readonly logger = new Logger(AnnualReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    sponsorshipId: number,
    staffUserId: number,
    files: AnnualReportFiles | undefined,
    lang = 'ar',
  ): Promise<CreateAnnualReportResponseDto> {
    const reportImageAr = files?.reportImageAr?.[0];
    const reportImageEn = files?.reportImageEn?.[0];
    const uploadedFiles = [reportImageAr, reportImageEn].filter(
      (file): file is Express.Multer.File => Boolean(file),
    );

    if (!reportImageAr || !reportImageEn) {
      await this.removeUploadedFiles(uploadedFiles);
      throw new BadRequestException(this.t('BOTH_IMAGES_REQUIRED', lang));
    }

    const mediaUrl = {
      ar: toPublicUploadPath(reportImageAr.path),
      en: toPublicUploadPath(reportImageEn.path),
    };
    const now = new Date();

    let creationResult: AnnualReportCreationResult;

    try {
      creationResult = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM Sponsorship
          WHERE id = ${sponsorshipId}
          FOR UPDATE
        `;

        const sponsorship = await tx.sponsorship.findUnique({
          where: { id: sponsorshipId },
          select: {
            id: true,
            status: true,
            orphanId: true,
            donor: {
              select: {
                userId: true,
              },
            },
            orphan: {
              select: {
                updatedAt: true,
              },
            },
          },
        });

        if (!sponsorship) {
          throw new NotFoundException(this.t('SPONSORSHIP_NOT_FOUND', lang));
        }

        if (sponsorship.status !== Status.ACCEPTED) {
          throw new BadRequestException(
            this.t('SPONSORSHIP_NOT_ACCEPTED', lang),
          );
        }

        if (!sponsorship.orphanId || !sponsorship.orphan) {
          throw new BadRequestException(this.t('ORPHAN_NOT_ASSIGNED', lang));
        }

        const employee = await tx.employee.findUnique({
          where: { userId: staffUserId },
          select: { id: true },
        });

        if (!employee) {
          throw new NotFoundException(this.t('EMPLOYEE_NOT_FOUND', lang));
        }

        const firstPayment = await tx.walletTransaction.findFirst({
          where: {
            type: TransactionType.SPONSORSHIP_DONATION,
            direction: WalletTransactionDirection.DEBIT,
            referenceType: SPONSORSHIP_REFERENCE_TYPE,
            referenceId: sponsorship.id,
          },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });

        if (!firstPayment) {
          throw new BadRequestException(this.t('FIRST_PAYMENT_REQUIRED', lang));
        }

        const reportAggregate = await tx.annualReport.aggregate({
          where: { sponsorshipId: sponsorship.id },
          _max: { reportNumber: true },
        });
        const reportNumber = (reportAggregate._max.reportNumber ?? 0) + 1;
        const dueAt = DateTime.fromJSDate(firstPayment.createdAt, {
          zone: 'utc',
        })
          .setZone(SPONSORSHIP_TIME_ZONE)
          .plus({ years: reportNumber });
        const localNow = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(
          SPONSORSHIP_TIME_ZONE,
        );

        if (localNow < dueAt) {
          throw new BadRequestException(
            this.t('REPORT_NOT_DUE', lang, {
              dueDate: dueAt.toFormat('yyyy-MM-dd'),
            }),
          );
        }

        const orphanUpdatedDay = DateTime.fromJSDate(
          sponsorship.orphan.updatedAt,
          { zone: 'utc' },
        )
          .setZone(SPONSORSHIP_TIME_ZONE)
          .startOf('day');
        const reportDueDay = dueAt.startOf('day');

        if (orphanUpdatedDay.toMillis() < reportDueDay.toMillis()) {
          throw new BadRequestException(this.t('ORPHAN_UPDATE_REQUIRED', lang));
        }

        const report = await tx.annualReport.create({
          data: {
            sponsorshipId: sponsorship.id,
            employeeId: employee.id,
            reportNumber,
            mediaUrl,
            createdAt: now,
          },
          select: {
            id: true,
            sponsorshipId: true,
            employeeId: true,
            reportNumber: true,
            mediaUrl: true,
            createdAt: true,
          },
        });

        return {
          response: {
            success: true,
            message: this.t('CREATE_SUCCESS', lang),
            data: {
              ...report,
              orphanId: sponsorship.orphanId,
              mediaUrl,
            },
          },
          donorUserId: sponsorship.donor.userId,
          reportId: report.id,
          sponsorshipId: sponsorship.id,
        };
      });
    } catch (error) {
      await this.removeUploadedFiles(uploadedFiles);
      throw error;
    }

    await this.notifyAnnualReportAvailable(
      creationResult.donorUserId,
      creationResult.reportId,
      creationResult.sponsorshipId,
    );

    return creationResult.response;
  }

  @Cron('0 9 * * *', { timeZone: SPONSORSHIP_TIME_ZONE })
  async handleAnnualReportDueNotifications(): Promise<void> {
    try {
      const notificationCount = await this.notifyDueAnnualReports();

      if (notificationCount > 0) {
        this.logger.log(
          `Created ${notificationCount} annual report due notification(s).`,
        );
      }
    } catch (error) {
      this.logger.error('Annual report due notification check failed.', error);
    }
  }

  async notifyDueAnnualReports(now = new Date()): Promise<number> {
    const sponsorships = await this.prisma.sponsorship.findMany({
      where: {
        status: Status.ACCEPTED,
        orphanId: { not: null },
      },
      select: {
        id: true,
        orphanId: true,
      },
    });
    const localNow = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(
      SPONSORSHIP_TIME_ZONE,
    );
    let notificationCount = 0;

    for (const sponsorship of sponsorships) {
      const firstPayment = await this.prisma.walletTransaction.findFirst({
        where: {
          type: TransactionType.SPONSORSHIP_DONATION,
          direction: WalletTransactionDirection.DEBIT,
          referenceType: SPONSORSHIP_REFERENCE_TYPE,
          referenceId: sponsorship.id,
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });

      if (!firstPayment || !sponsorship.orphanId) continue;

      const reportAggregate = await this.prisma.annualReport.aggregate({
        where: { sponsorshipId: sponsorship.id },
        _max: { reportNumber: true },
      });
      const reportNumber = (reportAggregate._max.reportNumber ?? 0) + 1;
      const dueAt = DateTime.fromJSDate(firstPayment.createdAt, {
        zone: 'utc',
      })
        .setZone(SPONSORSHIP_TIME_ZONE)
        .plus({ years: reportNumber });

      if (localNow < dueAt) continue;

      const dueDate = dueAt.toFormat('yyyy-MM-dd');
      const result = await this.notificationsService.createAndSendToPermission(
        'create:annual_reports',
        {
          title: {
            ar: 'حان موعد التقرير السنوي للكفالة',
            en: 'Sponsorship annual report is due',
          },
          message: {
            ar: 'مضى عام على الكفالة، يرجى تحديث بيانات اليتيم ورفع التقرير السنوي للكفيل.',
            en: 'The sponsorship annual report is due. Please update the orphan information and upload the annual report for the sponsor.',
          },
          targetType: 'ANNUAL_REPORT_DUE',
          targetId: sponsorship.id,
          additionalData: {
            sponsorshipId: String(sponsorship.id),
            orphanId: String(sponsorship.orphanId),
            reportNumber: String(reportNumber),
            dueDate,
          },
        },
        'ar',
        { excludeNotifiedSince: dueAt.toUTC().toJSDate() },
      );

      notificationCount += result.notificationCount;
    }

    return notificationCount;
  }

  async findForDonor(
    sponsorshipId: number,
    user: AnnualReportDonorPayload,
    lang = 'ar',
  ): Promise<DonorAnnualReportsResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException(this.t('AUTHENTICATION_REQUIRED', lang));
    }

    const userType = user.type ?? user.userType;
    if (userType !== UserType.DONOR) {
      throw new ForbiddenException(this.t('ONLY_DONORS_CAN_VIEW', lang));
    }

    const donor = await this.prisma.donor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!donor) {
      throw new ForbiddenException(this.t('DONOR_ACCOUNT_NOT_FOUND', lang));
    }

    const sponsorship = await this.prisma.sponsorship.findFirst({
      where: {
        id: sponsorshipId,
        donorId: donor.id,
      },
      select: { id: true },
    });

    if (!sponsorship) {
      throw new NotFoundException(this.t('SPONSORSHIP_NOT_FOUND', lang));
    }

    const firstPayment = await this.prisma.walletTransaction.findFirst({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: SPONSORSHIP_REFERENCE_TYPE,
        referenceId: sponsorship.id,
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    if (!firstPayment) {
      throw new ForbiddenException(
        this.t('DONOR_REPORTS_PAYMENT_REQUIRED', lang),
      );
    }

    const reports = await this.prisma.annualReport.findMany({
      where: { sponsorshipId: sponsorship.id },
      orderBy: { reportNumber: 'desc' },
      select: {
        id: true,
        reportNumber: true,
        mediaUrl: true,
        createdAt: true,
      },
    });
    const firstPaymentAt = DateTime.fromJSDate(firstPayment.createdAt, {
      zone: 'utc',
    }).setZone(SPONSORSHIP_TIME_ZONE);

    return {
      success: true,
      message: this.t('DONOR_FETCH_SUCCESS', lang),
      data: reports.map((report) => ({
        id: report.id,
        reportNumber: report.reportNumber,
        reportYear: firstPaymentAt.plus({ years: report.reportNumber }).year,
        imageUrl: this.getLocalizedMediaUrl(report.mediaUrl, lang),
        createdAt: report.createdAt,
      })),
    };
  }

  private getLocalizedMediaUrl(value: unknown, lang: string): string {
    let mediaUrl = value;

    if (typeof mediaUrl === 'string') {
      const rawMediaUrl = mediaUrl;
      try {
        mediaUrl = JSON.parse(mediaUrl) as unknown;
      } catch {
        return rawMediaUrl;
      }
    }

    if (mediaUrl && typeof mediaUrl === 'object' && !Array.isArray(mediaUrl)) {
      const localized = mediaUrl as Record<string, unknown>;
      const selectedLanguage = lang === 'en' ? 'en' : 'ar';
      const selected =
        localized[selectedLanguage] ?? localized.ar ?? localized.en;

      if (typeof selected === 'string') {
        return selected;
      }
    }

    throw new BadRequestException(this.t('REPORT_IMAGE_MISSING', lang));
  }

  private async removeUploadedFiles(
    files: Express.Multer.File[],
  ): Promise<void> {
    await Promise.all(
      files.map((file) => unlink(file.path).catch(() => undefined)),
    );
  }

  private async notifyAnnualReportAvailable(
    donorUserId: number,
    reportId: number,
    sponsorshipId: number,
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSend({
        userId: donorUserId,
        title: {
          ar: 'تم رفع التقرير السنوي',
          en: 'Annual report available',
        },
        message: {
          ar: 'أصبح التقرير السنوي الجديد لليتيم المكفول متاحاً، يمكنك الاطلاع عليه الآن.',
          en: 'A new annual report for your sponsored orphan is now available. You can view it now.',
        },
        targetType: 'ANNUAL_REPORT',
        targetId: reportId,
        additionalData: {
          sponsorshipId: String(sponsorshipId),
        },
      });
    } catch {
      this.logger.warn(
        `Failed to create the annual report notification for report ${reportId}`,
      );
    }
  }

  private t(
    key: string,
    lang: string,
    args?: Record<string, string | number>,
  ): string {
    return this.i18n.t(`annual-report.${key}`, { lang, args });
  }
}
