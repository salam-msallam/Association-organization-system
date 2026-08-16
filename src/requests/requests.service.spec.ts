import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  let notificationsService: any;
  let service: RequestAidService;

  beforeEach(() => {
    prisma = {
      requestAid: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        fields: {
          cost: 'requestAid.cost',
        },
      },
      employee: {
        findUnique: jest.fn(),
      },
      beneficiary: {
        findUnique: jest.fn(),
      },
      aidDetails: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn((callback) =>
        callback({
          requestAid: {
            update: prisma.requestAid.update,
          },
          aidDetails: {
            findUnique: prisma.aidDetails.findUnique,
            upsert: prisma.aidDetails.upsert,
          },
        }),
      ),
    };
    i18n = {
      t: jest.fn((key, options) => `${key}:${options?.lang ?? 'ar'}`),
    };
    notificationsService = {
      createAndSend: jest.fn().mockResolvedValue({
        notificationId: 1,
        pushSent: true,
      }),
      createAndSendToPermission: jest.fn().mockResolvedValue({
        recipientCount: 1,
        notificationCount: 1,
        pushSentCount: 1,
      }),
    };
    service = new RequestAidService(prisma, i18n, notificationsService);
  });

  it('lists accepted public aid requests by category without descriptions', async () => {
    prisma.requestAid.findMany.mockResolvedValue([
      {
        id: 1,
        title: { ar: 'عملية عاجلة', en: 'Urgent surgery' },
        cost: new Prisma.Decimal(2500),
        currentPayment: new Prisma.Decimal(1250),
        isUrgent: true,
        categoryId: 3,
        category: { name: { ar: 'Health AR', en: 'Health' } },
        aidDetails: {
          donorImageUrl: 'uploads/request-media/donor-surgery.png',
        },
      },
      {
        id: 2,
        title: JSON.stringify({ ar: 'رسوم جامعية', en: 'Tuition' }),
        cost: new Prisma.Decimal(100),
        currentPayment: new Prisma.Decimal(150),
        isUrgent: null,
        categoryId: 3,
        category: {
          name: JSON.stringify({ ar: 'Education AR', en: 'Education' }),
        },
        aidDetails: {
          donorImageUrl: null,
        },
      },
    ]);

    const result = await service.getPublicAidRequests(3, 'en');

    expect(prisma.requestAid.findMany).toHaveBeenCalledWith({
      where: { status: Status.ACCEPTED, categoryId: 3 },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        cost: true,
        currentPayment: true,
        isUrgent: true,
        categoryId: true,
        category: { select: { name: true } },
        aidDetails: { select: { donorImageUrl: true } },
      },
    });
    expect(result).toEqual([
      {
        id: 1,
        category: { id: 3, name: 'Health' },
        image: 'uploads/request-media/donor-surgery.png',
        title: 'Urgent surgery',
        totalCost: '2500',
        paidAmount: '1250',
        remainingAmount: '1250',
        completionPercentage: 50,
        isUrgent: true,
      },
      {
        id: 2,
        category: { id: 3, name: 'Education' },
        image: null,
        title: 'Tuition',
        totalCost: '100',
        paidAmount: '150',
        remainingAmount: '-50',
        completionPercentage: 100,
        isUrgent: false,
      },
    ]);
    expect(result[0]).not.toHaveProperty('description');
  });

  it('lists all accepted public aid requests when category is not provided', async () => {
    prisma.requestAid.findMany.mockResolvedValue([
      {
        id: 3,
        title: { ar: 'سلة غذائية', en: 'Food basket' },
        cost: new Prisma.Decimal(100),
        currentPayment: new Prisma.Decimal(-20),
        isUrgent: false,
        categoryId: 2,
        category: { name: { ar: 'Food AR', en: 'Food' } },
        aidDetails: { donorImageUrl: null },
      },
    ]);

    const result = await service.getPublicAidRequests(undefined, 'ar');

    expect(prisma.requestAid.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: Status.ACCEPTED },
      }),
    );
    expect(result[0].image).toBeNull();
    expect(result[0]).toEqual(
      expect.objectContaining({
        title: 'سلة غذائية',
        remainingAmount: '120',
        category: { id: 2, name: 'Food AR' },
        completionPercentage: 0,
      }),
    );
  });

  it('filters public aid requests to urgent cases when requested', async () => {
    prisma.requestAid.findMany.mockResolvedValue([]);

    await service.getPublicAidRequests(2, 'en', true);

    expect(prisma.requestAid.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: Status.ACCEPTED,
          categoryId: 2,
          isUrgent: true,
        },
      }),
    );
  });

  it('filters public aid requests to non-urgent and unset cases when requested', async () => {
    prisma.requestAid.findMany.mockResolvedValue([]);

    await service.getPublicAidRequests(undefined, 'ar', false);

    expect(prisma.requestAid.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: Status.ACCEPTED,
          OR: [{ isUrgent: false }, { isUrgent: null }],
        },
      }),
    );
  });

  it('lists all completed accepted public aid requests regardless of category', async () => {
    prisma.requestAid.findMany.mockResolvedValue([
      {
        id: 5,
        title: { ar: 'ط¹ظ„ط§ط¬ ظ…ظƒطھظ…ظ„', en: 'Completed treatment' },
        cost: new Prisma.Decimal(2500),
        currentPayment: new Prisma.Decimal(2500),
        isUrgent: true,
        categoryId: 4,
        category: { name: { ar: 'Health AR', en: 'Health' } },
        aidDetails: {
          donorImageUrl: 'uploads/request-media/completed-treatment.png',
        },
      },
    ]);

    const result = await service.getCompletedPublicAidRequests('en');

    expect(prisma.requestAid.findMany).toHaveBeenCalledWith({
      where: {
        status: Status.ACCEPTED,
        currentPayment: {
          equals: prisma.requestAid.fields.cost,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        cost: true,
        currentPayment: true,
        isUrgent: true,
        categoryId: true,
        category: { select: { name: true } },
        aidDetails: { select: { donorImageUrl: true } },
      },
    });
    expect(result).toEqual([
      {
        id: 5,
        category: { id: 4, name: 'Health' },
        image: 'uploads/request-media/completed-treatment.png',
        title: 'Completed treatment',
        totalCost: '2500',
        paidAmount: '2500',
        remainingAmount: '0',
        completionPercentage: 100,
        isUrgent: true,
      },
    ]);
  });

  it('returns one accepted public aid request with localized description', async () => {
    prisma.requestAid.findFirst.mockResolvedValue({
      id: 4,
      title: { ar: 'إيجار عاجل', en: 'Urgent rent' },
      description: {
        ar: 'وصف الطلب بعد المراجعة',
        en: 'Reviewed request description',
      },
      cost: new Prisma.Decimal(0),
      currentPayment: new Prisma.Decimal(50),
      isUrgent: true,
      aidDetails: {
        donorImageUrl: 'uploads/request-media/donor-rent.webp',
      },
    });

    const result = await service.getPublicAidRequestById('4', 'en-US');

    expect(prisma.requestAid.findFirst).toHaveBeenCalledWith({
      where: {
        id: 4,
        status: Status.ACCEPTED,
      },
      select: {
        id: true,
        title: true,
        description: true,
        cost: true,
        currentPayment: true,
        isUrgent: true,
        aidDetails: { select: { donorImageUrl: true } },
      },
    });
    expect(result).toEqual({
      image: 'uploads/request-media/donor-rent.webp',
      title: 'Urgent rent',
      description: 'Reviewed request description',
      totalCost: '0',
      paidAmount: '50',
      remainingAmount: '-50',
      completionPercentage: 0,
      isUrgent: true,
    });
  });

  it('throws a translated not-found error for missing or unapproved public detail requests', async () => {
    prisma.requestAid.findFirst.mockResolvedValue(null);

    await expect(service.getPublicAidRequestById('404', 'en')).rejects.toThrow(
      NotFoundException,
    );
    expect(i18n.t).toHaveBeenCalledWith('help-requests.REQUEST_NOT_FOUND', {
      lang: 'en',
    });
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'throws a translated bad request error for invalid public request ID %s',
    async (id) => {
      await expect(service.getPublicAidRequestById(id, 'ar')).rejects.toThrow(
        BadRequestException,
      );
      expect(i18n.t).toHaveBeenCalledWith('help-requests.INVALID_ID', {
        lang: 'ar',
      });
      expect(prisma.requestAid.findFirst).not.toHaveBeenCalled();
    },
  );

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
        donorImageUrl: 'uploads/request-media/donor-facing.png',
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
          donorImageUrl: 'uploads/request-media/donor-facing.png',
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

  it('accepts an assistance request with review metadata', async () => {
    const reviewedAt = new Date('2026-07-16T10:00:00.000Z');
    const title = { ar: 'عملية جراحية', en: 'Surgery' };
    const description = {
      ar: 'وصف حالة الطلب بعد المراجعة',
      en: 'Reviewed request description',
    };

    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      status: Status.PENDING,
      beneficiary: { userId: 19 },
    });
    prisma.employee.findUnique.mockResolvedValue({ id: 7 });
    prisma.requestAid.update.mockResolvedValue({
      id: 13,
      status: Status.ACCEPTED,
      title,
      description,
      isUrgent: true,
      rejectionReason: null,
      reviewedAt,
    });
    prisma.aidDetails.upsert.mockResolvedValue({
      donorImageUrl: 'uploads/request-media/donor-facing.png',
    });

    const result = await service.reviewHelpRequestStatus(
      '13',
      3,
      {
        status: Status.ACCEPTED,
        title,
        description,
        isUrgent: true,
        donorImageUrl: 'uploads/request-media/ignored-by-upload.png',
      },
      'uploads/request-media/donor-facing.png',
      'en',
    );

    expect(prisma.employee.findUnique).toHaveBeenCalledWith({
      where: { userId: 3 },
      select: { id: true },
    });
    expect(prisma.requestAid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 13 },
        data: expect.objectContaining({
          status: Status.ACCEPTED,
          title,
          description,
          isUrgent: true,
          rejectionReason: Prisma.JsonNull,
          reviewedAt: expect.any(Date),
          employeeId: 7,
        }),
      }),
    );
    expect(prisma.aidDetails.upsert).toHaveBeenCalledWith({
      where: { requestId: 13 },
      create: {
        requestId: 13,
        donorImageUrl: 'uploads/request-media/donor-facing.png',
      },
      update: {
        donorImageUrl: 'uploads/request-media/donor-facing.png',
      },
      select: { donorImageUrl: true },
    });
    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 19,
      title: {
        ar: 'تم قبول طلب الإعانة',
        en: 'Your assistance request has been accepted',
      },
      message: {
        ar: 'تم قبول طلب الإعانة الخاص بك وأصبح متاحاً للمتبرعين .',
        en: 'Your assistance request has been accepted and is now available for funding.',
      },
      targetType: 'REQUEST_AID',
      targetId: 13,
    });
    expect(result).toEqual({
      success: true,
      message: 'help-requests.STATUS_UPDATE_SUCCESS:en',
      data: {
        id: 13,
        status: Status.ACCEPTED,
        title,
        description,
        isUrgent: true,
        donorImageUrl: 'uploads/request-media/donor-facing.png',
        rejectionReason: null,
        reviewedAt,
      },
    });
  });

  it('requires a rejection reason when rejecting a request', async () => {
    await expect(
      service.reviewHelpRequestStatus(
        '13',
        3,
        {
          status: Status.REJECTED,
          title: { ar: 'عنوان', en: 'Title' },
          description: { ar: 'وصف', en: 'Description' },
          isUrgent: false,
        },
        undefined,
        'ar',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith(
      'help-requests.REJECTION_REASON_REQUIRED',
      { lang: 'ar' },
    );
    expect(prisma.requestAid.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an assistance request with a bilingual rejection reason', async () => {
    const title = { ar: 'عنوان', en: 'Title' };
    const description = { ar: 'وصف', en: 'Description' };
    const rejectionReason = {
      ar: 'البيانات غير كافية',
      en: 'Insufficient data',
    };
    const reviewedAt = new Date('2026-07-16T10:00:00.000Z');

    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      status: Status.PENDING,
      beneficiary: { userId: 19 },
    });
    prisma.employee.findUnique.mockResolvedValue(null);
    prisma.requestAid.update.mockResolvedValue({
      id: 13,
      status: Status.REJECTED,
      title,
      description,
      isUrgent: false,
      rejectionReason,
      reviewedAt,
    });

    const result = await service.reviewHelpRequestStatus(
      '13',
      1,
      {
        status: Status.REJECTED,
        title,
        description,
        isUrgent: false,
        rejectionReason,
      },
      undefined,
      'en',
    );

    expect(prisma.requestAid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: Status.REJECTED,
          rejectionReason,
          employeeId: null,
        }),
      }),
    );
    expect(result.data.rejectionReason).toEqual(rejectionReason);
    expect(notificationsService.createAndSend).toHaveBeenCalledWith({
      userId: 19,
      title: {
        ar: 'تم رفض طلب الإعانة',
        en: 'Your assistance request has been rejected',
      },
      message: {
        ar: `تم رفض طلب الإعانة الخاص بك. لأن: ${rejectionReason.ar}`,
        en: `Your assistance request has been rejected. because ${rejectionReason.en}`,
      },
      targetType: 'REQUEST_AID',
      targetId: 13,
    });
  });

  it('ignores acceptance-only fields and media when rejecting a request', async () => {
    const rejectionReason = { ar: 'Not eligible', en: 'Not eligible' };

    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      status: Status.PENDING,
      beneficiary: { userId: 19 },
    });
    prisma.employee.findUnique.mockResolvedValue({ id: 7 });
    prisma.requestAid.update.mockResolvedValue({
      id: 13,
      status: Status.REJECTED,
      title: null,
      description: null,
      isUrgent: null,
      rejectionReason,
      reviewedAt: new Date('2026-07-16T10:00:00.000Z'),
    });
    prisma.aidDetails.upsert.mockResolvedValue({ donorImageUrl: null });

    const result = await service.reviewHelpRequestStatus(
      '13',
      3,
      {
        status: Status.REJECTED,
        title: { ar: 'Title', en: 'Title' },
        description: { ar: 'Description', en: 'Description' },
        isUrgent: true,
        donorImageUrl: 'uploads/request-media/ignored.png',
        rejectionReason,
      },
      'uploads/request-media/upload-ignored.png',
      'en',
    );

    expect(prisma.requestAid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: Prisma.JsonNull,
          description: Prisma.JsonNull,
          isUrgent: null,
          rejectionReason,
        }),
      }),
    );
    expect(prisma.aidDetails.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { donorImageUrl: null },
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        title: null,
        description: null,
        isUrgent: false,
        donorImageUrl: null,
        rejectionReason,
      }),
    );
  });

  it('preserves existing donor-facing media when accepting without donor media', async () => {
    const reviewedAt = new Date('2026-07-16T10:00:00.000Z');
    const title = { ar: 'Title', en: 'Title' };
    const description = { ar: 'Description', en: 'Description' };
    const donorImageUrl = 'uploads/request-media/existing-donor.png';

    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      status: Status.PENDING,
      beneficiary: { userId: 19 },
    });
    prisma.employee.findUnique.mockResolvedValue({ id: 7 });
    prisma.requestAid.update.mockResolvedValue({
      id: 13,
      status: Status.ACCEPTED,
      title,
      description,
      isUrgent: false,
      rejectionReason: null,
      reviewedAt,
    });
    prisma.aidDetails.findUnique.mockResolvedValue({ donorImageUrl });

    const result = await service.reviewHelpRequestStatus(
      '13',
      3,
      {
        status: Status.ACCEPTED,
        title,
        description,
        isUrgent: false,
      },
      undefined,
      'en',
    );

    expect(prisma.aidDetails.upsert).not.toHaveBeenCalled();
    expect(prisma.aidDetails.findUnique).toHaveBeenCalledWith({
      where: { requestId: 13 },
      select: { donorImageUrl: true },
    });
    expect(result.data.donorImageUrl).toBe(donorImageUrl);
  });

  it('throws a translated error for invalid review status', async () => {
    await expect(
      service.reviewHelpRequestStatus(
        '13',
        3,
        {
          status: Status.PENDING as any,
          title: { ar: 'عنوان', en: 'Title' },
          description: { ar: 'وصف', en: 'Description' },
          isUrgent: false,
        },
        undefined,
        'ar',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('help-requests.INVALID_REVIEW_STATUS', {
      lang: 'ar',
    });
    expect(prisma.requestAid.findUnique).not.toHaveBeenCalled();
  });

  it('throws a translated not-found error when reviewing a missing request', async () => {
    prisma.requestAid.findUnique.mockResolvedValue(null);

    await expect(
      service.reviewHelpRequestStatus(
        '404',
        3,
        {
          status: Status.ACCEPTED,
          title: { ar: 'عنوان', en: 'Title' },
          description: { ar: 'وصف', en: 'Description' },
          isUrgent: false,
        },
        undefined,
        'en',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(i18n.t).toHaveBeenCalledWith('help-requests.REQUEST_NOT_FOUND', {
      lang: 'en',
    });
  });

  it('does not allow reviewing cancelled requests', async () => {
    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      status: Status.CANCELLED,
    });

    await expect(
      service.reviewHelpRequestStatus(
        '13',
        3,
        {
          status: Status.ACCEPTED,
          title: { ar: 'عنوان', en: 'Title' },
          description: { ar: 'وصف', en: 'Description' },
          isUrgent: false,
        },
        undefined,
        'ar',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith(
      'help-requests.CANCELLED_REQUEST_CANNOT_BE_REVIEWED',
      { lang: 'ar' },
    );
    expect(prisma.requestAid.update).not.toHaveBeenCalled();
  });

  it('notifies authorized staff after creating an assistance request', async () => {
    const requestAidCreate = jest.fn().mockResolvedValue({ id: 31 });
    const aidDetailsCreate = jest.fn().mockResolvedValue({ id: 50 });
    prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
    prisma.category = {
      findUnique: jest.fn().mockResolvedValue({
        id: 2,
        name: { ar: 'صحي', en: 'Health' },
      }),
    };
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        requestAid: { create: requestAidCreate },
        aidDetails: { create: aidDetailsCreate },
      }),
    );

    const result = await service.createRequestAid(
      19,
      2,
      null,
      {
        firstName: 'Sara',
        lastName: 'Ahmad',
        beneficiaryFatherName: 'Mohammad',
        socialStatus: SocialStatus.MARRIED,
        address: { ar: 'دمشق', en: 'Damascus' },
        age: 35,
        isUnemployed: false,
        gender: Gender.FEMALE,
        number: '0991000000',
        details: { ar: 'تفاصيل', en: 'Details' },
        cost: 100,
      },
      {
        typeAid: TypeAid.SURGERY,
        mediaUrls: ['uploads/request-media/report.png'],
      },
      'Health',
    );

    expect(result).toEqual({ message: 'تم تقديم طلب المساعدة بنجاح' });
    expect(notificationsService.createAndSendToPermission).toHaveBeenCalledWith(
      'status:aid_requests',
      {
        title: {
          ar: 'طلب إعانة جديد بانتظار المراجعة',
          en: 'New assistance request awaiting review',
        },
        message: {
          ar: 'تم إنشاء طلب إعانة جديد ويحتاج إلى مراجعة بياناته.',
          en: 'A new assistance request has been created and requires review.',
        },
        targetType: 'AID_REQUEST_REVIEW',
        targetId: 31,
      },
    );
    expect(aidDetailsCreate.mock.invocationCallOrder[0]).toBeLessThan(
      notificationsService.createAndSendToPermission.mock
        .invocationCallOrder[0],
    );
  });

  it('keeps the created assistance request when staff notification fails', async () => {
    prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
    prisma.category = {
      findUnique: jest.fn().mockResolvedValue({
        id: 2,
        name: { ar: 'صحي', en: 'Health' },
      }),
    };
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        requestAid: {
          create: jest.fn().mockResolvedValue({ id: 31 }),
        },
        aidDetails: { create: jest.fn() },
      }),
    );
    notificationsService.createAndSendToPermission.mockRejectedValue(
      new Error('notification database error'),
    );

    await expect(
      service.createRequestAid(
        19,
        2,
        null,
        {
          firstName: 'Sara',
          lastName: 'Ahmad',
          beneficiaryFatherName: 'Mohammad',
          socialStatus: SocialStatus.MARRIED,
          address: { ar: 'دمشق', en: 'Damascus' },
          age: 35,
          isUnemployed: false,
          gender: Gender.FEMALE,
          number: '0991000000',
          details: { ar: 'تفاصيل', en: 'Details' },
          cost: 100,
        },
        { typeAid: TypeAid.SURGERY },
        'Health',
      ),
    ).resolves.toEqual({ message: 'تم تقديم طلب المساعدة بنجاح' });
  });

  it('resets review metadata when a beneficiary edits a non-cancelled request', async () => {
    const txRequestAidUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const txAidDetailsUpdate = jest.fn();
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        requestAid: { updateMany: txRequestAidUpdateMany },
        aidDetails: { update: txAidDetailsUpdate },
      }),
    );
    prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      beneficiaryId: 5,
      subCategoryId: null,
      status: Status.ACCEPTED,
      firstName: 'Mona',
      lastName: 'Ali',
      beneficiaryFatherName: 'Hassan',
      socialStatus: SocialStatus.MARRIED,
      address: { ar: 'دمشق', en: 'Damascus' },
      age: 35,
      isUnemployed: false,
      gender: Gender.FEMALE,
      number: '991000001',
      details: { ar: 'تفاصيل', en: 'Details' },
      cost: new Prisma.Decimal(2500),
      aidDetails: { mediaUrls: ['uploads/request-media/example.png'] },
      category: { name: { ar: 'صحي', en: 'Health' } },
    });

    await service.updateRequestAid(2, 13, { firstName: 'Mona Updated' }, {});

    expect(txRequestAidUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 13,
          beneficiaryId: 5,
          status: { not: Status.CANCELLED },
        },
        data: expect.objectContaining({
          firstName: 'Mona Updated',
          status: Status.PENDING,
          title: Prisma.JsonNull,
          description: Prisma.JsonNull,
          rejectionReason: Prisma.JsonNull,
          isUrgent: null,
          reviewedAt: null,
          employeeId: null,
        }),
      }),
    );
    expect(txAidDetailsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaUrls: ['uploads/request-media/example.png'],
          donorImageUrl: null,
        }),
      }),
    );
  });

  it('does not allow beneficiary edits for cancelled requests', async () => {
    prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
    prisma.requestAid.findUnique.mockResolvedValue({
      id: 13,
      beneficiaryId: 5,
      status: Status.CANCELLED,
      aidDetails: null,
    });

    await expect(
      service.updateRequestAid(2, 13, { firstName: 'New' }, {}),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['ar', 'صحي', 'جراحة', 'الوثائق ناقصة'],
    ['en', 'Health', 'Surgery', 'Documents are incomplete'],
  ])(
    'filters beneficiary requests by status and localizes fields in %s',
    async (lang, categoryName, subCategoryName, rejectionReason) => {
      prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
      prisma.requestAid.findMany.mockResolvedValue([
        {
          id: 13,
          categoryId: 2,
          subCategoryId: 7,
          title: {
            ar: 'طلب عملية جراحية',
            en: 'Surgery request',
          },
          status: Status.REJECTED,
          rejectionReason: {
            ar: 'الوثائق ناقصة',
            en: 'Documents are incomplete',
          },
          cost: new Prisma.Decimal(100),
          currentPayment: new Prisma.Decimal(0),
          isUrgent: null,
          createdAt: new Date('2026-07-30T12:00:00.000Z'),
          updatedAt: new Date('2026-07-30T12:00:00.000Z'),
          category: {
            id: 2,
            name: { ar: 'صحي', en: 'Health' },
          },
          subCategory: {
            id: 7,
            name: { ar: 'جراحة', en: 'Surgery' },
          },
          aidDetails: {
            typeAid: TypeAid.SURGERY,
          },
        },
      ]);

      const result = await service.getMyRequests(19, 'rejected', lang);

      expect(prisma.requestAid.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { beneficiaryId: 5, status: Status.REJECTED },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: 13,
          title: lang === 'ar' ? 'طلب عملية جراحية' : 'Surgery request',
          status: Status.REJECTED,
          rejectionReason,
          typeAid: TypeAid.SURGERY,
          cost: '100',
          currentPayment: '0',
          category: { id: 2, name: categoryName },
          subCategory: { id: 7, name: subCategoryName },
        }),
      ]);
    },
  );

  it('returns every beneficiary request when status is omitted', async () => {
    prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
    prisma.requestAid.findMany.mockResolvedValue([]);

    await service.getMyRequests(19, undefined, 'ar');

    expect(prisma.requestAid.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { beneficiaryId: 5 } }),
    );
  });

  it('rejects an invalid my-requests status in the requested language', async () => {
    await expect(service.getMyRequests(19, 'unknown', 'en')).rejects.toThrow(
      BadRequestException,
    );

    expect(i18n.t).toHaveBeenCalledWith('help-requests.INVALID_STATUS', {
      lang: 'en',
    });
    expect(prisma.requestAid.findMany).not.toHaveBeenCalled();
  });

  it('returns a translated error when the account is not a beneficiary', async () => {
    prisma.beneficiary.findUnique.mockResolvedValue(null);

    await expect(service.getMyRequests(19, undefined, 'en')).rejects.toThrow(
      ForbiddenException,
    );

    expect(i18n.t).toHaveBeenCalledWith(
      'help-requests.BENEFICIARY_PROFILE_REQUIRED',
      { lang: 'en' },
    );
  });

  it('returns one owned beneficiary request with localized full details', async () => {
    prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
    prisma.requestAid.findFirst.mockResolvedValue({
      id: 13,
      categoryId: 2,
      subCategoryId: 7,
      firstName: 'Sara',
      lastName: 'Ahmad',
      beneficiaryFatherName: 'Mohammad',
      socialStatus: SocialStatus.MARRIED,
      address: { ar: 'دمشق', en: 'Damascus' },
      age: 35,
      isUnemployed: false,
      gender: Gender.FEMALE,
      number: '0991000000',
      title: { ar: 'طلب عملية', en: 'Surgery request' },
      details: { ar: 'تفاصيل الطلب', en: 'Request details' },
      description: { ar: 'وصف الطلب', en: 'Request description' },
      cost: new Prisma.Decimal(2500),
      currentPayment: new Prisma.Decimal(1250),
      status: Status.ACCEPTED,
      rejectionReason: null,
      isUrgent: true,
      createdAt: new Date('2026-07-30T12:00:00.000Z'),
      reviewedAt: new Date('2026-07-31T12:00:00.000Z'),
      updatedAt: new Date('2026-07-31T12:00:00.000Z'),
      category: { id: 2, name: { ar: 'صحي', en: 'Health' } },
      subCategory: { id: 7, name: { ar: 'جراحة', en: 'Surgery' } },
      aidDetails: {
        academicAchievement: null,
        institutionName: null,
        year: null,
        numberIndividuals: null,
        projectName: null,
        projectCategory: null,
        numberOfPeopleSupported: null,
        currentHousingSituation: null,
        typeAid: TypeAid.SURGERY,
        currentRent: null,
        currentPlaceOfResidence: null,
        reasonForLock: null,
        housingSpecifications: null,
        mediaUrls: ['uploads/request-media/report.png'],
        donorImageUrl: 'uploads/request-media/donor.png',
      },
    });

    const result = await service.getMyRequestById(19, 13, 'en-US');

    expect(prisma.beneficiary.findUnique).toHaveBeenCalledWith({
      where: { userId: 19 },
      select: { id: true },
    });
    expect(prisma.requestAid.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 13, beneficiaryId: 5 },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 13,
        address: 'Damascus',
        title: 'Surgery request',
        details: 'Request details',
        description: 'Request description',
        cost: '2500',
        currentPayment: '1250',
        compliancePercentage: 50,
        category: { id: 2, name: 'Health' },
        subCategory: { id: 7, name: 'Surgery' },
        aidDetails: {
          typeAid: TypeAid.SURGERY,
          mediaUrls: ['uploads/request-media/report.png'],
          donorImageUrl: 'uploads/request-media/donor.png',
        },
      }),
    );
  });

  it('does not expose a request that is not owned by the beneficiary', async () => {
    prisma.beneficiary.findUnique.mockResolvedValue({ id: 5 });
    prisma.requestAid.findFirst.mockResolvedValue(null);

    await expect(service.getMyRequestById(19, 99, 'en')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.requestAid.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 99, beneficiaryId: 5 },
      }),
    );
    expect(i18n.t).toHaveBeenCalledWith('help-requests.REQUEST_NOT_FOUND', {
      lang: 'en',
    });
  });

  it('rejects getting one request when the account is not a beneficiary', async () => {
    prisma.beneficiary.findUnique.mockResolvedValue(null);

    await expect(service.getMyRequestById(19, 13, 'ar')).rejects.toThrow(
      ForbiddenException,
    );

    expect(prisma.requestAid.findFirst).not.toHaveBeenCalled();
    expect(i18n.t).toHaveBeenCalledWith(
      'help-requests.BENEFICIARY_PROFILE_REQUIRED',
      { lang: 'ar' },
    );
  });
});
