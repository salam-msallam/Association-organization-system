import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Gender,
  Prisma,
  SocialStatus,
  Status,
  UserType,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BeneficiaryService } from './beneficiary.service';
import { ReviewBeneficiaryDto } from './dto/review-beneficiary.dto';

describe('BeneficiaryService', () => {
  let service: BeneficiaryService;
  let prisma: any;
  let i18n: any;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      beneficiary: {
        updateMany: jest.fn(),
      },
    };

    i18n = {
      t: jest.fn((key, options) => `${key}:${options?.lang ?? 'ar'}`),
    };

    service = new BeneficiaryService(prisma, i18n);
  });

  it('lists beneficiaries with default pagination', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 2,
        firstName: 'Sara',
        lastName: 'Ali',
        beneficiary: {
          status: Status.PENDING,
          socialStatus: SocialStatus.WIDOWED,
        },
      },
    ]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.findAll(undefined, 1, 10, 'en');

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userType: UserType.BENEFICIARY,
          beneficiary: { isNot: null },
        },
        skip: 0,
        take: 10,
      }),
    );
    expect(result).toEqual({
      success: true,
      message: 'beneficiary.FETCH_SUCCESS:en',
      data: [
        {
          id: 2,
          firstName: 'Sara',
          lastName: 'Ali',
          status: Status.PENDING,
          socialStatus: SocialStatus.WIDOWED,
        },
      ],
      meta: {
        totalCount: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it('normalizes lowercase status filters', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.findAll('pending', 1, 10, 'ar');

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userType: UserType.BENEFICIARY,
          beneficiary: { is: { status: Status.PENDING } },
        },
      }),
    );
  });

  it('throws a translated error for invalid status filters', async () => {
    await expect(service.findAll('waiting', 1, 10, 'en')).rejects.toThrow(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('beneficiary.INVALID_STATUS', {
      lang: 'en',
    });
  });

  it('returns full beneficiary details by user account id', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    prisma.user.findFirst.mockResolvedValue({
      id: 7,
      firstName: 'Mona',
      lastName: 'Hassan',
      email: 'mona@example.com',
      number: '999999999',
      countryName: 'Syria',
      countryCode: '+963',
      gender: Gender.FEMALE,
      createdAt,
      updatedAt,
      beneficiary: {
        id: 3,
        personalPhoto: 'uploads\\beneficiaries\\photo.jpg',
        familyStatement: 'uploads\\beneficiaries\\family.jpg',
        address: { ar: 'دمشق', en: 'Damascus' },
        status: Status.ACCEPTED,
        rejectionReason: null,
        socialStatus: SocialStatus.MARRIED,
        numberOfChildren: 2,
        isUnemployed: false,
        monthlyIncome: 500,
      },
    });

    const result = await service.findOne(7, 'en', 'http://localhost:3000');

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 7,
          userType: UserType.BENEFICIARY,
          beneficiary: { isNot: null },
        },
      }),
    );
    expect(result.data.beneficiary.address).toEqual({
      ar: 'دمشق',
      en: 'Damascus',
    });
    expect(result.data.beneficiary.rejectionReason).toBeNull();
    expect(result.data.beneficiary.personalPhoto).toBe(
      'http://localhost:3000/uploads/beneficiaries/photo.jpg',
    );
    expect(result.data.beneficiary.familyStatement).toBe(
      'uploads/beneficiaries/family.jpg',
    );
  });

  it('returns both languages from bilingual fields when lang is ar', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 7,
      firstName: 'Mona',
      lastName: 'Hassan',
      email: 'mona@example.com',
      number: '999999999',
      countryName: 'Syria',
      countryCode: '+963',
      gender: Gender.FEMALE,
      createdAt: new Date(),
      updatedAt: new Date(),
      beneficiary: {
        id: 3,
        personalPhoto: 'photo.jpg',
        familyStatement: 'family.jpg',
        address: { ar: 'دمشق', en: 'Damascus' },
        status: Status.ACCEPTED,
        rejectionReason: { ar: 'سبب', en: 'Reason' },
        socialStatus: SocialStatus.MARRIED,
        numberOfChildren: 2,
        isUnemployed: false,
        monthlyIncome: 500,
      },
    });

    const result = await service.findOne(7, 'ar');

    expect(result.data.beneficiary.address).toEqual({
      ar: 'دمشق',
      en: 'Damascus',
    });
    expect(result.data.beneficiary.rejectionReason).toEqual({
      ar: 'سبب',
      en: 'Reason',
    });
  });

  it('throws a translated not found error when the user account is missing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findOne(404, 'en')).rejects.toThrow(NotFoundException);
    expect(i18n.t).toHaveBeenCalledWith('beneficiary.NOT_FOUND', {
      lang: 'en',
    });
  });

  it('accepts a pending beneficiary and clears the rejection reason', async () => {
    prisma.user.findFirst.mockResolvedValue({
      beneficiary: { status: Status.PENDING },
    });
    prisma.beneficiary.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reviewStatus(
      7,
      { status: Status.ACCEPTED },
      'en',
    );

    expect(prisma.beneficiary.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 7,
        status: Status.PENDING,
      },
      data: {
        status: Status.ACCEPTED,
        rejectionReason: Prisma.JsonNull,
      },
    });
    expect(result).toEqual({
      success: true,
      message: 'beneficiary.STATUS_UPDATE_SUCCESS:en',
      data: {
        id: 7,
        status: Status.ACCEPTED,
        rejectionReason: null,
      },
    });
  });

  it('rejects a pending beneficiary with Arabic and English reasons', async () => {
    const rejectionReason = {
      ar: 'الوثائق غير مكتملة',
      en: 'The documents are incomplete',
    };
    prisma.user.findFirst.mockResolvedValue({
      beneficiary: { status: Status.PENDING },
    });
    prisma.beneficiary.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reviewStatus(
      7,
      {
        status: Status.REJECTED,
        rejectionReason,
      },
      'ar',
    );

    expect(prisma.beneficiary.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 7,
        status: Status.PENDING,
      },
      data: {
        status: Status.REJECTED,
        rejectionReason,
      },
    });
    expect(result.data).toEqual({
      id: 7,
      status: Status.REJECTED,
      rejectionReason,
    });
  });

  it('requires a rejection reason when rejecting a beneficiary', async () => {
    await expect(
      service.reviewStatus(7, { status: Status.REJECTED }, 'en'),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith(
      'beneficiary.REJECTION_REASON_REQUIRED',
      { lang: 'en' },
    );
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an unsupported review status', async () => {
    await expect(
      service.reviewStatus(
        7,
        { status: Status.PENDING } as ReviewBeneficiaryDto,
        'en',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith(
      'beneficiary.INVALID_REVIEW_STATUS',
      { lang: 'en' },
    );
  });

  it.each([Status.ACCEPTED, Status.REJECTED])(
    'does not review an account already in %s',
    async (status) => {
      prisma.user.findFirst.mockResolvedValue({
        beneficiary: { status },
      });

      await expect(
        service.reviewStatus(7, { status: Status.ACCEPTED }, 'en'),
      ).rejects.toThrow(BadRequestException);

      expect(i18n.t).toHaveBeenCalledWith('beneficiary.ALREADY_REVIEWED', {
        lang: 'en',
      });
      expect(prisma.beneficiary.updateMany).not.toHaveBeenCalled();
    },
  );

  it('returns not found for an account that is not a beneficiary', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.reviewStatus(7, { status: Status.ACCEPTED }, 'en'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 7,
        userType: UserType.BENEFICIARY,
        beneficiary: { isNot: null },
      },
      select: {
        beneficiary: {
          select: { status: true },
        },
      },
    });
  });

  it('allows only one concurrent review to update a pending account', async () => {
    prisma.user.findFirst.mockResolvedValue({
      beneficiary: { status: Status.PENDING },
    });
    prisma.beneficiary.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.reviewStatus(7, { status: Status.ACCEPTED }, 'en'),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('beneficiary.ALREADY_REVIEWED', {
      lang: 'en',
    });
  });

  it('validates that both rejection reason languages are present', async () => {
    const dto = plainToInstance(ReviewBeneficiaryDto, {
      status: Status.REJECTED,
      rejectionReason: {
        ar: 'سبب الرفض',
      },
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
  });

  it('does not accept empty rejection reasons', async () => {
    const dto = plainToInstance(ReviewBeneficiaryDto, {
      status: Status.REJECTED,
      rejectionReason: {
        ar: '',
        en: 'The documents are incomplete',
      },
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
  });
});
