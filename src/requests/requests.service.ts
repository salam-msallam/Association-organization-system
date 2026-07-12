import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Gender, Prisma, SocialStatus } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

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