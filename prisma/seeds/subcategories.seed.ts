import { PrismaClient } from '@prisma/client';
import { SeededCategories, SeededSubCategories } from './seed.types';

export async function seedSubCategories(
  prisma: PrismaClient,
  categories: SeededCategories,
): Promise<SeededSubCategories> {
  await prisma.subCategory.upsert({
    where: { id: 1 },
    update: {},
    create: {
      categoryId: categories.housingCategoryId,
      name: { ar: 'تأمين منزل', en: 'Home Insurance' },
    },
  });
  const rentAssistanceSubCategory = await prisma.subCategory.upsert({
    where: { id: 2 },
    update: {},
    create: {
      categoryId: categories.housingCategoryId,
      name: { ar: 'مساعدة في إيجار البيت', en: 'Rent Assistance' },
    },
  });
  const homeRepairsSubCategory = await prisma.subCategory.upsert({
    where: { id: 3 },
    update: {},
    create: {
      categoryId: categories.housingCategoryId,
      name: { ar: 'إصلاحات منزلية', en: 'Home Repairs' },
    },
  });

  return {
    rentAssistanceSubCategoryId: rentAssistanceSubCategory.id,
    homeRepairsSubCategoryId: homeRepairsSubCategory.id,
  };
}
