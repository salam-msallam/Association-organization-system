import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AcademicAchievement,
  Gender,
  Prisma,
  SocialStatus,
  Status,
  TypeAid,
} from '@prisma/client';
import { RequestAidService } from './requests.service';

describe('RequestAidService admin APIs', () => {
  let prisma: any;
  let i18n: any;
  let service: RequestAidService;

  beforeEach(() => {
    prisma = {
      requestAid: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    i18n = {
      t: jest.fn((key, options) => `${key}:${options?.lang ?? 'ar'}`),
    };
    service = new RequestAidService(prisma, i18n);
  });

  it('filters by normalized status and maps the requested fields', async () => {
    prisma.requestAid.findMany.mockResolvedValue([
      {
        id: 1,
        firstName: 'Mona',
        lastName: 'Ali',
        status: Status.ACCEPTED,
        isUrgent: true,
        cost: new Prisma.Decimal(2500),
        currentPayment: new Prisma.Decimal(1250),
        aidDetails: { typeAid: TypeAid.SURGERY },
        category: { name: { ar: 'صحي', en: 'Health' } },
      },
      {
        id: 2,
        firstName: 'Sami',
        lastName: 'Hassan',
        status: Status.ACCEPTED,
        isUrgent: null,
        cost: new Prisma.Decimal(100),
        currentPayment: new Prisma.Decimal(150),
        aidDetails: { typeAid: null },
        category: { name: { ar: 'تعليمي', en: 'Education' } },
      },
      {
        id: 3,
        firstName: 'Rana',
        lastName: 'Omar',
        status: Status.ACCEPTED,
        isUrgent: false,
        cost: new Prisma.Decimal(0),
        currentPayment: new Prisma.Decimal(20),
        aidDetails: null,
        category: { name: { ar: 'سكني', en: 'Housing' } },
      },
    ]);
    prisma.requestAid.count.mockResolvedValue(3);

    const result = await service.getAdminHelpRequests('accepted', 1, 10, 'en');

    expect(prisma.requestAid.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: Status.ACCEPTED },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.data).toEqual([
      expect.objectContaining({
        status: Status.ACCEPTED,
        typeAid: TypeAid.SURGERY,
        isUrgent: true,
        compliancePercentage: 50,
      }),
      expect.objectContaining({
        typeAid: 'Education',
        isUrgent: false,
        compliancePercentage: 100,
      }),
      expect.objectContaining({
        typeAid: 'Housing',
        compliancePercentage: 0,
      }),
    ]);
    expect(result.meta).toEqual({
      totalCount: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('throws a translated error for an invalid status', async () => {
    await expect(
      service.getAdminHelpRequests('waiting', 1, 10, 'ar'),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('help-requests.INVALID_STATUS', {
      lang: 'ar',
    });
    expect(prisma.requestAid.findMany).not.toHaveBeenCalled();
  });

  it('returns complete bilingual assistance request details', async () => {
    const createdAt = new Date('2026-07-01T10:00:00.000Z');
    const reviewedAt = new Date('2026-07-05T10:00:00.000Z');
    const updatedAt = new Date('2026-07-05T10:00:00.000Z');
    const address = { ar: 'دمشق', en: 'Damascus' };
    const title = { ar: 'عملية جراحية', en: 'Surgery' };
    const details = { ar: 'تفاصيل الطلب', en: 'Request details' };
    const institutionName = { ar: 'جامعة دمشق', en: 'Damascus University' };

    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      firstName: 'Mona',
      lastName: 'Ali',
      beneficiaryFatherName: 'Hassan',
      socialStatus: SocialStatus.MARRIED,
      address,
      age: 35,
      isUnemployed: false,
      gender: Gender.FEMALE,
      number: '991000001',
      title,
      details,
      description: null,
      cost: new Prisma.Decimal(2500),
      currentPayment: new Prisma.Decimal(1250),
      status: Status.ACCEPTED,
      rejectionReason: null,
      isUrgent: null,
      createdAt,
      reviewedAt,
      updatedAt,
      category: { id: 1, name: { ar: 'صحي', en: 'Health' } },
      subCategory: null,
      aidDetails: {
        academicAchievement: AcademicAchievement.BACHELOR,
        institutionName,
        year: '2026',
        numberIndividuals: null,
        projectName: null,
        projectCategory: null,
        numberOfPeopleSupported: null,
        currentHousingSituation: null,
        typeAid: TypeAid.SURGERY,
        currentRent: new Prisma.Decimal(200),
        currentPlaceOfResidence: null,
        reasonForLock: null,
        housingSpecifications: null,
        mediaUrls: ['uploads/request-media/example.png'],
      },
    });

    const result = await service.getAdminHelpRequestById('13', 'en');

    expect(prisma.requestAid.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 13 },
        select: expect.objectContaining({
          address: true,
          category: expect.any(Object),
          subCategory: expect.any(Object),
          aidDetails: expect.any(Object),
        }),
      }),
    );
    const requestSelect = prisma.requestAid.findUnique.mock.calls[0][0].select;
    expect(requestSelect).not.toHaveProperty('beneficiaryId');
    expect(requestSelect).not.toHaveProperty('employeeId');
    expect(requestSelect.aidDetails.select).not.toHaveProperty('id');
    expect(requestSelect.aidDetails.select).not.toHaveProperty('requestId');
    expect(result).toEqual({
      success: true,
      message: 'help-requests.FETCH_ONE_SUCCESS:en',
      data: expect.objectContaining({
        id: 13,
        address,
        title,
        details,
        description: null,
        rejectionReason: null,
        cost: '2500',
        currentPayment: '1250',
        compliancePercentage: 50,
        isUrgent: false,
        category: { id: 1, name: { ar: 'صحي', en: 'Health' } },
        subCategory: null,
        aidDetails: {
          academicAchievement: AcademicAchievement.BACHELOR,
          institutionName,
          year: '2026',
          typeAid: TypeAid.SURGERY,
          currentRent: '200',
          mediaUrls: ['uploads/request-media/example.png'],
        },
      }),
    });
    expect(i18n.t).toHaveBeenCalledWith('help-requests.FETCH_ONE_SUCCESS', {
      lang: 'en',
    });
  });

  it('returns an empty aidDetails object when the relation is missing', async () => {
    prisma.requestAid.findUnique.mockResolvedValue({
      id: 14,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(0),
      isUrgent: false,
      aidDetails: null,
    });

    const result = await service.getAdminHelpRequestById('14', 'en');

    expect(result.data.aidDetails).toEqual({});
  });

  it('removes null aidDetails fields while preserving zero and empty arrays', async () => {
    prisma.requestAid.findUnique.mockResolvedValue({
      id: 15,
      cost: new Prisma.Decimal(100),
      currentPayment: new Prisma.Decimal(0),
      isUrgent: false,
      aidDetails: {
        currentRent: null,
        numberIndividuals: 0,
        projectName: null,
        mediaUrls: [],
      },
    });

    const result = await service.getAdminHelpRequestById('15', 'ar');

    expect(result.data.aidDetails).toEqual({
      numberIndividuals: 0,
      mediaUrls: [],
    });
    expect(result.data.aidDetails).not.toHaveProperty('currentRent');
    expect(result.data.aidDetails).not.toHaveProperty('projectName');
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'throws a translated error for invalid request ID %s',
    async (id) => {
      await expect(service.getAdminHelpRequestById(id, 'ar')).rejects.toThrow(
        BadRequestException,
      );
      expect(i18n.t).toHaveBeenCalledWith('help-requests.INVALID_ID', {
        lang: 'ar',
      });
      expect(prisma.requestAid.findUnique).not.toHaveBeenCalled();
    },
  );

  it('throws a translated not-found error', async () => {
    prisma.requestAid.findUnique.mockResolvedValue(null);

    await expect(service.getAdminHelpRequestById('404', 'en')).rejects.toThrow(
      NotFoundException,
    );
    expect(i18n.t).toHaveBeenCalledWith('help-requests.REQUEST_NOT_FOUND', {
      lang: 'en',
    });
  });
});
