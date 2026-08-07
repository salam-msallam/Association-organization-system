import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Status,
  TransactionType,
  WalletTransactionDirection,
} from '@prisma/client';
import { DateTime } from 'luxon';
import { I18nService } from 'nestjs-i18n';
import { unlink } from 'node:fs/promises';
import { toPublicUploadPath } from '../interceptors/upload-storage.util';
import { PrismaService } from '../prisma/prisma.service';
import { SPONSORSHIP_TIME_ZONE } from '../sponsorship/sponsorship-billing-period';
import { CreateAnnualReportResponseDto } from './dto/create-annual-report-response.dto';

const SPONSORSHIP_REFERENCE_TYPE = 'SPONSORSHIP';

interface AnnualReportFiles {
  reportImageAr?: Express.Multer.File[];
  reportImageEn?: Express.Multer.File[];
}

@Injectable()
export class AnnualReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
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

    try {
      return await this.prisma.$transaction(async (tx) => {
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
          success: true,
          message: this.t('CREATE_SUCCESS', lang),
          data: {
            ...report,
            orphanId: sponsorship.orphanId,
            mediaUrl,
          },
        };
      });
    } catch (error) {
      await this.removeUploadedFiles(uploadedFiles);
      throw error;
    }
  }

  private async removeUploadedFiles(
    files: Express.Multer.File[],
  ): Promise<void> {
    await Promise.all(
      files.map((file) => unlink(file.path).catch(() => undefined)),
    );
  }

  private t(
    key: string,
    lang: string,
    args?: Record<string, string | number>,
  ): string {
    return this.i18n.t(`annual-report.${key}`, { lang, args });
  }
}
