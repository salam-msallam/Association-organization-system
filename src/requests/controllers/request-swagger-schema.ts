import {
  AcademicAchievement,
  Gender,
  SocialStatus,
  TypeAid,
} from '@prisma/client';

const baseRequired = [
  'categoryId',
  'firstName',
  'lastName',
  'beneficiaryFatherName',
  'socialStatus',
  'address',
  'age',
  'isUnemployed',
  'gender',
  'number',
  'details',
  'cost',
  'media',
];


export const bilingualTextProperty = {
  type: 'string',
  format: 'json',
  description: 'أدخل قيمة JSON بصيغة {"ar":"...","en":"..."}',
  example: '{"ar":"دمشق - المزة","en":"Damascus - Al Mazzeh"}',
};

const baseProperties = {
  categoryId: { type: 'integer', example: 1 },
  firstName: { type: 'string', example: 'Ahmad' },
  lastName: { type: 'string', example: 'Ali' },
  beneficiaryFatherName: { type: 'string', example: 'Mohammad' },
  socialStatus: {
    type: 'string',
    enum: Object.values(SocialStatus),
    example: SocialStatus.WIDOWED,
  },
  address: bilingualTextProperty,
  age: { type: 'integer', example: 35 },
  isUnemployed: { type: 'boolean', example: true },
  gender: { type: 'string', enum: Object.values(Gender), example: Gender.MALE },
  number: { type: 'string', example: '0999999999' },
  details: {
    ...bilingualTextProperty,
    properties: {
      ar: { type: 'string', example: 'بحاجة إلى دعم دوائي للعلاج الشهري' },
      en: {
        type: 'string',
        example: 'Need medicine support for monthly treatment',
      },
    },
  },
  cost: { type: 'number', example: 100 },
  media: {
    type: 'array',
    items: { type: 'string', format: 'binary' },
  },
};

export function requestBodySchema(
  extraProperties: Record<string, unknown>,
  requiredExtraFields: string[],
) {
  return {
    type: 'object',
    required: [...baseRequired, ...requiredExtraFields],
    properties: {
      ...baseProperties,
      ...extraProperties,
    },
  };
}

export const typeAidProperty = {
  type: 'string',
  enum: Object.values(TypeAid),
  example: TypeAid.MEDICINE_INSURANCE,
};

export const academicAchievementProperty = {
  type: 'string',
  enum: Object.values(AcademicAchievement),
  example: AcademicAchievement.BACHELOR,
};
