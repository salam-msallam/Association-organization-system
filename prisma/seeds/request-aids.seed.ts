import {
  AcademicAchievement,
  Prisma,
  PrismaClient,
  Status,
  TypeAid,
} from '@prisma/client';
import { TEST_REQUEST_MEDIA_URL } from './media.seed';
import {
  AcceptedBeneficiary,
  SeededCategories,
  SeededSubCategories,
} from './seed.types';

type SeedAidRequest = {
  categoryId: number;
  subCategoryId?: number;
  status: Status;
  isUrgent: boolean;
  reviewAfterDays?: number;
  title: { ar: string; en: string };
  cost: number;
  aidDetails: Prisma.AidDetailsUncheckedCreateWithoutRequestAidInput;
};

export async function seedRequestAids(
  prisma: PrismaClient,
  categories: SeededCategories,
  subCategories: SeededSubCategories,
  acceptedBeneficiaries: AcceptedBeneficiary[],
): Promise<number> {
  const seededAidRequests = buildSeededAidRequests(categories, subCategories);
  const seededRequestNumbers = Array.from(
    { length: seededAidRequests.length },
    (_, index) => `991000${(index + 1).toString().padStart(3, '0')}`,
  );
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const seedStartedAt = Date.now();

  await prisma.$transaction(async (transaction) => {
    await transaction.requestAid.deleteMany({
      where: { number: { in: seededRequestNumbers } },
    });

    for (const [index, requestData] of seededAidRequests.entries()) {
      const beneficiary =
        acceptedBeneficiaries[index % acceptedBeneficiaries.length];
      const createdAt = new Date(
        seedStartedAt - (30 - index) * millisecondsPerDay,
      );
      const reviewedAt = requestData.reviewAfterDays
        ? new Date(
            createdAt.getTime() +
              requestData.reviewAfterDays * millisecondsPerDay,
          )
        : null;

      await transaction.requestAid.create({
        data: {
          beneficiaryId: beneficiary.id,
          categoryId: requestData.categoryId,
          subCategoryId: requestData.subCategoryId,
          firstName: beneficiary.user.firstName,
          lastName: beneficiary.user.lastName,
          beneficiaryFatherName: `Father ${index + 1}`,
          socialStatus: beneficiary.socialStatus,
          address: beneficiary.address as Prisma.InputJsonValue,
          age: 25 + index * 3,
          isUnemployed: beneficiary.isUnemployed,
          gender: beneficiary.user.gender,
          number: seededRequestNumbers[index],
          title: requestData.title,
          details: {
            ar: `تفاصيل طلب الإعانة التجريبي رقم ${index + 1}`,
            en: `Seeded assistance request details ${index + 1}`,
          },
          description: {
            ar: 'بيانات تجريبية لاختبار لوحة التحكم',
            en: 'Test data for dashboard statistics',
          },
          cost: requestData.cost,
          status: requestData.status,
          rejectionReason:
            requestData.status === Status.REJECTED
              ? {
                  ar: 'لم يستوف الطلب شروط القبول التجريبية.',
                  en: 'The request did not meet the test acceptance criteria.',
                }
              : Prisma.JsonNull,
          isUrgent: requestData.isUrgent,
          createdAt,
          reviewedAt,
          aidDetails: { create: requestData.aidDetails },
        },
      });
    }
  });

  return seededAidRequests.length;
}

function buildSeededAidRequests(
  categories: SeededCategories,
  subCategories: SeededSubCategories,
): SeedAidRequest[] {
  return [
    {
      categoryId: categories.healthCategoryId,
      status: Status.PENDING,
      isUrgent: false,
      title: { ar: 'تأمين دواء مزمن', en: 'Chronic medicine coverage' },
      cost: 180,
      aidDetails: {
        typeAid: TypeAid.MEDICINE_INSURANCE,
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.healthCategoryId,
      status: Status.ACCEPTED,
      isUrgent: true,
      reviewAfterDays: 2,
      title: { ar: 'عملية جراحية عاجلة', en: 'Urgent surgery' },
      cost: 2500,
      aidDetails: {
        typeAid: TypeAid.SURGERY,
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.foodCategoryId,
      status: Status.REJECTED,
      isUrgent: false,
      reviewAfterDays: 3,
      title: { ar: 'سلة غذائية شهرية', en: 'Monthly food basket' },
      cost: 120,
      aidDetails: {
        typeAid: TypeAid.FOOD_BASKET,
        numberIndividuals: 6,
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.foodCategoryId,
      status: Status.PENDING,
      isUrgent: false,
      title: { ar: 'حليب أطفال', en: 'Baby milk assistance' },
      cost: 90,
      aidDetails: {
        numberIndividuals: 4,
        typeAid: TypeAid.BABY_MILK,
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.housingCategoryId,
      subCategoryId: subCategories.rentAssistanceSubCategoryId,
      status: Status.ACCEPTED,
      isUrgent: true,
      reviewAfterDays: 4,
      title: { ar: 'مساعدة إيجار عاجلة', en: 'Urgent rent assistance' },
      cost: 600,
      aidDetails: {
        currentRent: 200,
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.housingCategoryId,
      subCategoryId: subCategories.homeRepairsSubCategoryId,
      status: Status.CANCELLED,
      isUrgent: false,
      title: { ar: 'إصلاح سقف المنزل', en: 'Home roof repair' },
      cost: 850,
      aidDetails: {
        currentHousingSituation: { ar: 'منزل متضرر', en: 'Damaged home' },
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.educationCategoryId,
      status: Status.ACCEPTED,
      isUrgent: false,
      reviewAfterDays: 8,
      title: { ar: 'رسوم جامعية', en: 'University tuition' },
      cost: 700,
      aidDetails: {
        academicAchievement: AcademicAchievement.BACHELOR,
        institutionName: { ar: 'جامعة دمشق', en: 'Damascus University' },
        year: '2026',
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.educationCategoryId,
      status: Status.REJECTED,
      isUrgent: false,
      reviewAfterDays: 5,
      title: { ar: 'مستلزمات دراسية', en: 'School supplies' },
      cost: 150,
      aidDetails: {
        academicAchievement: AcademicAchievement.HIGH_SCHOOL,
        institutionName: { ar: 'مدرسة الأمل', en: 'Al-Amal School' },
        year: '2026',
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.smallProjectsCategoryId,
      status: Status.ACCEPTED,
      isUrgent: true,
      reviewAfterDays: 6,
      title: { ar: 'مشروع خياطة منزلي', en: 'Home sewing project' },
      cost: 1100,
      aidDetails: {
        projectName: { ar: 'مشغل الأمل', en: 'Hope Workshop' },
        projectCategory: { ar: 'خياطة', en: 'Sewing' },
        numberOfPeopleSupported: 5,
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
    {
      categoryId: categories.smallProjectsCategoryId,
      status: Status.PENDING,
      isUrgent: false,
      title: { ar: 'عربة مأكولات صغيرة', en: 'Small food cart' },
      cost: 950,
      aidDetails: {
        projectName: { ar: 'لقمة طيبة', en: 'Good Bite' },
        projectCategory: { ar: 'مأكولات', en: 'Food' },
        numberOfPeopleSupported: 4,
        mediaUrls: [TEST_REQUEST_MEDIA_URL],
      },
    },
  ];
}
