import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Gender, Prisma, SocialStatus, Status } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminHelpRequestDetailDto,
  AdminHelpRequestDetailResponseDto,
} from './dto/admin-help-request-detail-response.dto';
import { AdminHelpRequestListResponseDto } from './dto/admin-help-request-list-response.dto';

export interface BilingualText {
  ar: string;
  en: string;
}

export interface RequestAidBaseFields {
  firstName: string;
  lastName: string;
  beneficiaryFatherName: string;
  socialStatus: SocialStatus;
  address: BilingualText;
  age: number;
  isUnemployed: boolean;
  gender: Gender;
  number: string;
  details: BilingualText;
  cost: number;
}

export type AidDetailsFields = Record<string, any>;

const AID_DETAILS_BILINGUAL_FIELDS = [
  'institutionName',
  'projectName',
  'projectCategory',
  'currentHousingSituation',
  'currentPlaceOfResidence',
  'reasonForLock',
  'housingSpecifications',
] as const;

@Injectable()
export class RequestAidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getAdminHelpRequests(
    status: string | undefined,
    page = 1,
    limit = 10,
    lang = 'ar',
  ): Promise<AdminHelpRequestListResponseDto> {
    const normalizedStatus = this.normalizeStatus(status, lang);
    const where: Prisma.RequestAidWhereInput = normalizedStatus
      ? { status: normalizedStatus }
      : {};
    const skip = (page - 1) * limit;

    const [requests, totalCount] = await Promise.all([
      this.prisma.requestAid.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          isUrgent: true,
          cost: true,
          currentPayment: true,
          aidDetails: { select: { typeAid: true } },
          category: { select: { name: true } },
        },
      }),
      this.prisma.requestAid.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: requests.map((request) => {
        return {
          id: request.id,
          firstName: request.firstName,
          lastName: request.lastName,
          status: request.status,
          typeAid:
            request.aidDetails?.typeAid ??
            this.translateCategoryName(request.category.name, lang),
          isUrgent: request.isUrgent ?? false,
          cost: request.cost.toString(),
          currentPayment: request.currentPayment.toString(),
          compliancePercentage: this.calculateCompliancePercentage(
            request.cost,
            request.currentPayment,
          ),
        };
      }),
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

  async getAdminHelpRequestById(
    id: string | number,
    lang = 'ar',
  ): Promise<AdminHelpRequestDetailResponseDto> {
    const requestId = this.parseRequestId(id, lang);
    const request = await this.prisma.requestAid.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        beneficiaryFatherName: true,
        socialStatus: true,
        address: true,
        age: true,
        isUnemployed: true,
        gender: true,
        number: true,
        title: true,
        details: true,
        description: true,
        cost: true,
        currentPayment: true,
        status: true,
        rejectionReason: true,
        isUrgent: true,
        createdAt: true,
        reviewedAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        subCategory: {
          select: {
            id: true,
            name: true,
          },
        },
        aidDetails: {
          select: {
            academicAchievement: true,
            institutionName: true,
            year: true,
            numberIndividuals: true,
            projectName: true,
            projectCategory: true,
            numberOfPeopleSupported: true,
            currentHousingSituation: true,
            typeAid: true,
            currentRent: true,
            currentPlaceOfResidence: true,
            reasonForLock: true,
            housingSpecifications: true,
            mediaUrls: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        this.i18n.t('help-requests.REQUEST_NOT_FOUND', { lang }),
      );
    }

    const data = {
      ...request,
      cost: request.cost.toString(),
      currentPayment: request.currentPayment.toString(),
      compliancePercentage: this.calculateCompliancePercentage(
        request.cost,
        request.currentPayment,
      ),
      isUrgent: request.isUrgent ?? false,
      aidDetails: this.removeNullishAidDetails(
        request.aidDetails
          ? {
              ...request.aidDetails,
              currentRent: request.aidDetails.currentRent?.toString(),
            }
          : {},
      ),
    } as unknown as AdminHelpRequestDetailDto;

    return {
      success: true,
      message: this.i18n.t('help-requests.FETCH_ONE_SUCCESS', { lang }),
      data,
    };
  }

  async createRequestAid(
    userId: number,
    categoryId: number,
    subCategoryId: number | null,
    baseFields: RequestAidBaseFields,
    aidDetailsFields: AidDetailsFields,
    expectedCategoryName: string,
    subCategoryRequiredFieldsMap?: Record<number, string[]>,
  ): Promise<{ message: string }> {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { userId },
    });

    if (!beneficiary) {
      throw new ForbiddenException(
        'هذا الحساب غير مرتبط بملف مستفيد، لا يمكن تقديم طلب مساعدة.',
      );
    }

    await this.validateCategorySelection(
      categoryId,
      subCategoryId,
      expectedCategoryName,
    );

    this.validateSubCategoryRequiredFields(
      subCategoryId,
      aidDetailsFields,
      subCategoryRequiredFieldsMap,
    );

    const sanitizedAidDetailsFields = this.stripFieldsNotAllowedForSubCategory(
      subCategoryId,
      aidDetailsFields,
      subCategoryRequiredFieldsMap,
    );

    return this.prisma.$transaction(async (tx) => {
      const requestAid = await tx.requestAid.create({
        data: {
          beneficiaryId: beneficiary.id,
          categoryId,
          subCategoryId: subCategoryId ?? undefined,

          firstName: baseFields.firstName,
          lastName: baseFields.lastName,
          beneficiaryFatherName: baseFields.beneficiaryFatherName,
          socialStatus: baseFields.socialStatus,
          age: baseFields.age,
          isUnemployed: baseFields.isUnemployed,
          gender: baseFields.gender,
          number: baseFields.number,
          cost: baseFields.cost,

          address: this.toInputJson(baseFields.address),
          title: Prisma.JsonNull,
          details: this.toInputJson(baseFields.details),
          description: Prisma.JsonNull,
        },
      });

      await tx.aidDetails.create({
        data: {
          requestId: requestAid.id,
          ...this.normalizeBilingualFields(sanitizedAidDetailsFields),
        },
      });

      return {
        message: 'تم تقديم طلب المساعدة بنجاح',
      };
    });
  }

  async getMyRequests(userId: number) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { userId },
    });

    if (!beneficiary) {
      throw new ForbiddenException(
        'هذا الحساب غير مرتبط بملف مستفيد، لا يمكن عرض طلبات المساعدة.',
      );
    }

    const requests = await this.prisma.requestAid.findMany({
      where: { beneficiaryId: beneficiary.id },
      select: {
        id: true,
        categoryId: true,
        subCategoryId: true,
        status: true,
        rejectionReason: true,
        cost: true,
        currentPayment: true,
        isUrgent: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { id: true, name: true },
        },
        subCategory: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => ({
      ...request,
      cost: request.cost.toString(),
      currentPayment: request.currentPayment.toString(),
    }));
  }

  async cancelRequestAid(
    userId: number,
    requestId: number,
  ): Promise<{ message: string }> {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { userId },
    });

    if (!beneficiary) {
      throw new ForbiddenException(
        'هذا الحساب غير مرتبط بملف مستفيد، لا يمكن إجراء العمليات.',
      );
    }

    const request = await this.prisma.requestAid.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('طلب المساعدة غير موجود.');
    }

    if (request.beneficiaryId !== beneficiary.id) {
      throw new ForbiddenException('ليس لديك الصلاحية لإلغاء هذا الطلب.');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `لا يمكن إلغاء الطلب الحالي لأنه في حالة: ${request.status}`,
      );
    }

    await this.prisma.requestAid.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    return {
      message: 'تم إلغاء طلب المساعدة بنجاح',
    };
  }

  async updateRequestAid(
    userId: number,
    requestId: number,
    baseFieldsPartial: Partial<RequestAidBaseFields>,
    aidDetailsFieldsPartial: AidDetailsFields,
    subCategoryRequiredFieldsMap?: Record<number, string[]>,
    newMediaUrls?: string[],
  ): Promise<{ message: string }> {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { userId },
    });

    if (!beneficiary) {
      throw new ForbiddenException(
        'هذا الحساب غير مرتبط بملف مستفيد، لا يمكن إجراء العمليات.',
      );
    }

    const existingRequest = await this.prisma.requestAid.findUnique({
      where: { id: requestId },
      include: { aidDetails: true },
    });

    if (!existingRequest) {
      throw new NotFoundException('طلب المساعدة غير موجود.');
    }

    if (existingRequest.beneficiaryId !== beneficiary.id) {
      throw new ForbiddenException('ليس لديك الصلاحية لتعديل هذا الطلب.');
    }

    if (existingRequest.status !== 'PENDING') {
      throw new BadRequestException(
        `لا يمكن تعديل الطلب الحالي لأنه في حالة: ${existingRequest.status}`,
      );
    }

    const mergedBaseFields: RequestAidBaseFields = {
      firstName: baseFieldsPartial.firstName ?? existingRequest.firstName,
      lastName: baseFieldsPartial.lastName ?? existingRequest.lastName,
      beneficiaryFatherName:
        baseFieldsPartial.beneficiaryFatherName ??
        existingRequest.beneficiaryFatherName,
      socialStatus:
        baseFieldsPartial.socialStatus ?? existingRequest.socialStatus,
      address:
        baseFieldsPartial.address ??
        (existingRequest.address as unknown as BilingualText),
      age: baseFieldsPartial.age ?? existingRequest.age,
      isUnemployed:
        baseFieldsPartial.isUnemployed ?? existingRequest.isUnemployed,
      gender: baseFieldsPartial.gender ?? existingRequest.gender,
      number: baseFieldsPartial.number ?? existingRequest.number,
      details:
        baseFieldsPartial.details ??
        (existingRequest.details as unknown as BilingualText),
      cost: baseFieldsPartial.cost ?? Number(existingRequest.cost),
    };

    const existingAidDetailsFields: AidDetailsFields =
      existingRequest.aidDetails ? { ...existingRequest.aidDetails } : {};

    const mergedAidDetailsFields = this.mergeDefinedFields(
      existingAidDetailsFields,
      aidDetailsFieldsPartial,
    );

    this.validateSubCategoryRequiredFields(
      existingRequest.subCategoryId,
      mergedAidDetailsFields,
      subCategoryRequiredFieldsMap,
    );

    const sanitizedAidDetailsFields = this.stripFieldsNotAllowedForSubCategory(
      existingRequest.subCategoryId,
      mergedAidDetailsFields,
      subCategoryRequiredFieldsMap,
    );

    const mediaUrlsToSave =
      newMediaUrls && newMediaUrls.length > 0
        ? newMediaUrls
        : (existingRequest.aidDetails?.mediaUrls as unknown as
            | string[]
            | undefined);

    return this.prisma.$transaction(async (tx) => {
      await tx.requestAid.update({
        where: { id: requestId },
        data: {
          firstName: mergedBaseFields.firstName,
          lastName: mergedBaseFields.lastName,
          beneficiaryFatherName: mergedBaseFields.beneficiaryFatherName,
          socialStatus: mergedBaseFields.socialStatus,
          age: mergedBaseFields.age,
          isUnemployed: mergedBaseFields.isUnemployed,
          gender: mergedBaseFields.gender,
          number: mergedBaseFields.number,
          cost: mergedBaseFields.cost,
          address: this.toInputJson(mergedBaseFields.address),
          details: this.toInputJson(mergedBaseFields.details),
        },
      });

      await tx.aidDetails.update({
        where: { requestId },
        data: {
          ...this.normalizeBilingualFields(sanitizedAidDetailsFields),
          mediaUrls: mediaUrlsToSave as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        message: 'تم تعديل طلب المساعدة بنجاح',
      };
    });
  }

  private async validateCategorySelection(
    categoryId: number,
    subCategoryId: number | null,
    expectedCategoryName: string,
  ): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    const categoryName = this.extractCategoryName(category.name);

    if (categoryName !== expectedCategoryName) {
      throw new BadRequestException(
        `categoryId ${categoryId} does not match the "${expectedCategoryName}" category.`,
      );
    }

    if (!subCategoryId) return;

    const subCategory = await this.prisma.subCategory.findFirst({
      where: {
        id: subCategoryId,
        categoryId,
      },
      select: { id: true },
    });

    if (!subCategory) {
      throw new BadRequestException(
        'subCategoryId must belong to the selected categoryId.',
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
        this.i18n.t('help-requests.INVALID_STATUS', { lang }),
      );
    }

    return normalizedStatus;
  }

  private parseRequestId(id: string | number, lang: string): number {
    const isValidString = typeof id !== 'string' || /^\d+$/.test(id.trim());
    const requestId = typeof id === 'number' ? id : Number(id);

    if (!isValidString || !Number.isInteger(requestId) || requestId <= 0) {
      throw new BadRequestException(
        this.i18n.t('help-requests.INVALID_ID', { lang }),
      );
    }

    return requestId;
  }

  private calculateCompliancePercentage(
    costValue: Prisma.Decimal,
    currentPaymentValue: Prisma.Decimal,
  ): number {
    const cost = Number(costValue);
    const currentPayment = Number(currentPaymentValue);
    const rawPercentage = cost > 0 ? (currentPayment / cost) * 100 : 0;

    return Math.min(
      100,
      Math.max(0, Math.round((rawPercentage + Number.EPSILON) * 100) / 100),
    );
  }

  private removeNullishAidDetails<T extends Record<string, unknown>>(
    aidDetails: T,
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(aidDetails).filter(
        ([, value]) => value !== null && value !== undefined,
      ),
    ) as Partial<T>;
  }

  private translateCategoryName(
    value: Prisma.JsonValue,
    lang: string,
  ): string | null {
    const supportedLanguage = lang === 'en' ? 'en' : 'ar';

    if (typeof value === 'string') {
      try {
        return this.translateCategoryName(JSON.parse(value), lang);
      } catch {
        return value;
      }
    }

    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    const translated =
      record[supportedLanguage] ?? record.ar ?? record.en ?? null;

    return typeof translated === 'string' ? translated : null;
  }

  private validateSubCategoryRequiredFields(
    subCategoryId: number | null,
    aidDetailsFields: AidDetailsFields,
    requiredFieldsMap?: Record<number, string[]>,
  ): void {
    if (!subCategoryId || !requiredFieldsMap) return;

    const requiredFields = requiredFieldsMap[subCategoryId];
    if (!requiredFields || requiredFields.length === 0) return;

    const missingFields = requiredFields.filter((field) => {
      const value = aidDetailsFields[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `الحقول التالية مطلوبة لهذا النوع الفرعي من الطلب: ${missingFields.join(', ')}`,
      );
    }
  }

  private stripFieldsNotAllowedForSubCategory(
    subCategoryId: number | null,
    aidDetailsFields: AidDetailsFields,
    requiredFieldsMap?: Record<number, string[]>,
  ): AidDetailsFields {
    if (!subCategoryId || !requiredFieldsMap) return aidDetailsFields;

    const allSubCategorySpecificFields = Array.from(
      new Set(Object.values(requiredFieldsMap).flat()),
    );
    const allowedFields = requiredFieldsMap[subCategoryId] ?? [];

    const sanitized: AidDetailsFields = { ...aidDetailsFields };

    for (const field of allSubCategorySpecificFields) {
      if (!allowedFields.includes(field)) {
        sanitized[field] = undefined;
      }
    }

    return sanitized;
  }

  private mergeDefinedFields<T extends Record<string, any>>(
    existing: T,
    partial: Partial<T>,
  ): T {
    const result: T = { ...existing };

    for (const key of Object.keys(partial)) {
      if (partial[key] !== undefined) {
        (result as any)[key] = partial[key];
      }
    }

    return result;
  }

  private extractCategoryName(name: Prisma.JsonValue): string {
    if (typeof name === 'object' && name !== null && 'en' in name) {
      return (name as { en: string }).en;
    }
    if (typeof name === 'string') {
      try {
        return JSON.parse(name).en;
      } catch {
        return name;
      }
    }
    return '';
  }

  private toInputJson(text: BilingualText): Prisma.InputJsonObject {
    return {
      ar: text.ar,
      en: text.en,
    };
  }

  private normalizeBilingualFields<T extends AidDetailsFields>(fields: T): T {
    const result: AidDetailsFields = { ...fields };

    for (const key of AID_DETAILS_BILINGUAL_FIELDS) {
      const value = result[key];
      if (!value) continue;

      result[key] = this.toInputJson(value);
    }

    return result as T;
  }
}
