import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Status,
  TransactionType,
  WalletTransactionDirection,
} from '@prisma/client';
import { AnnualReportService } from './annual-report.service';

describe('AnnualReportService', () => {
  let prisma: any;
  let tx: any;
  let i18n: any;
  let service: AnnualReportService;

  const createFiles = () => ({
    reportImageAr: [
      {
        path: 'uploads/annual-reports/report-ar.jpg',
      } as Express.Multer.File,
    ],
    reportImageEn: [
      {
        path: 'uploads/annual-reports/report-en.jpg',
      } as Express.Multer.File,
    ],
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-08-02T09:00:00.000Z'));

    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 5 }]),
      sponsorship: {
        findUnique: jest.fn().mockResolvedValue({
          id: 5,
          status: Status.ACCEPTED,
          orphanId: 3,
          orphan: {
            updatedAt: new Date('2027-08-01T00:00:00.000Z'),
          },
        }),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({ id: 2 }),
      },
      walletTransaction: {
        findFirst: jest.fn().mockResolvedValue({
          createdAt: new Date('2026-08-01T09:00:00.000Z'),
        }),
      },
      annualReport: {
        aggregate: jest.fn().mockResolvedValue({
          _max: { reportNumber: null },
        }),
        create: jest.fn().mockResolvedValue({
          id: 12,
          sponsorshipId: 5,
          employeeId: 2,
          reportNumber: 1,
          mediaUrl: {
            ar: 'uploads/annual-reports/report-ar.jpg',
            en: 'uploads/annual-reports/report-en.jpg',
          },
          createdAt: new Date('2027-08-02T09:00:00.000Z'),
        }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: any) => unknown) =>
        callback(tx),
      ),
    };
    i18n = {
      t: jest.fn(
        (key: string, options?: any) =>
          `${key}:${options?.lang ?? 'ar'}${options?.args?.dueDate ? `:${options.args.dueDate}` : ''}`,
      ),
    };
    service = new AnnualReportService(prisma, i18n);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates the first due annual report', async () => {
    const files = createFiles();

    const result = await service.create(5, 20, files, 'ar');

    expect(tx.employee.findUnique).toHaveBeenCalledWith({
      where: { userId: 20 },
      select: { id: true },
    });
    expect(tx.annualReport.create).toHaveBeenCalledWith({
      data: {
        sponsorshipId: 5,
        employeeId: 2,
        reportNumber: 1,
        mediaUrl: {
          ar: 'uploads/annual-reports/report-ar.jpg',
          en: 'uploads/annual-reports/report-en.jpg',
        },
        createdAt: new Date('2027-08-02T09:00:00.000Z'),
      },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      success: true,
      message: 'annual-report.CREATE_SUCCESS:ar',
      data: {
        id: 12,
        sponsorshipId: 5,
        orphanId: 3,
        employeeId: 2,
        reportNumber: 1,
        mediaUrl: {
          ar: 'uploads/annual-reports/report-ar.jpg',
          en: 'uploads/annual-reports/report-en.jpg',
        },
        createdAt: new Date('2027-08-02T09:00:00.000Z'),
      },
    });
  });

  it('rejects sending the report before its first anniversary', async () => {
    jest.setSystemTime(new Date('2027-07-31T09:00:00.000Z'));
    const files = createFiles();

    await expect(service.create(5, 20, files, 'en')).rejects.toThrow(
      BadRequestException,
    );

    expect(tx.annualReport.create).not.toHaveBeenCalled();
    expect(i18n.t).toHaveBeenCalledWith(
      'annual-report.REPORT_NOT_DUE',
      expect.objectContaining({ lang: 'en' }),
    );
  });

  it('requires the orphan information to be updated for the current report cycle', async () => {
    tx.sponsorship.findUnique.mockResolvedValue({
      id: 5,
      status: Status.ACCEPTED,
      orphanId: 3,
      orphan: {
        updatedAt: new Date('2027-07-31T20:00:00.000Z'),
      },
    });
    const files = createFiles();

    await expect(service.create(5, 20, files, 'ar')).rejects.toThrow(
      BadRequestException,
    );

    expect(tx.annualReport.create).not.toHaveBeenCalled();
    expect(i18n.t).toHaveBeenCalledWith(
      'annual-report.ORPHAN_UPDATE_REQUIRED',
      expect.objectContaining({ lang: 'ar' }),
    );
  });

  it('requires both localized report images before opening a transaction', async () => {
    await expect(service.create(5, 20, undefined, 'ar')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(i18n.t).toHaveBeenCalledWith(
      'annual-report.BOTH_IMAGES_REQUIRED',
      expect.objectContaining({ lang: 'ar' }),
    );
  });

  it('rejects the request when only one localized image is provided', async () => {
    const { reportImageAr } = createFiles();
    const files = { reportImageAr };

    await expect(service.create(5, 20, files, 'en')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(i18n.t).toHaveBeenCalledWith(
      'annual-report.BOTH_IMAGES_REQUIRED',
      expect.objectContaining({ lang: 'en' }),
    );
  });

  it('returns not found for a missing sponsorship', async () => {
    tx.sponsorship.findUnique.mockResolvedValue(null);
    const files = createFiles();

    await expect(service.create(99, 20, files, 'ar')).rejects.toThrow(
      NotFoundException,
    );

    expect(tx.annualReport.create).not.toHaveBeenCalled();
  });

  it('checks the first payment using sponsorship wallet transaction fields', async () => {
    const files = createFiles();

    await service.create(5, 20, files);

    expect(tx.walletTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        type: TransactionType.SPONSORSHIP_DONATION,
        direction: WalletTransactionDirection.DEBIT,
        referenceType: 'SPONSORSHIP',
        referenceId: 5,
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
  });
});
