import { PrismaClient } from '@prisma/client';
import { SeededCategories } from './seed.types';

export async function seedCategories(
  prisma: PrismaClient,
): Promise<SeededCategories> {
  const healthCategory = await prisma.category.upsert({
    where: { id: 1 },
    update: {},
    create: { name: { ar: 'صحي', en: 'Health' } },
  });
  const foodCategory = await prisma.category.upsert({
    where: { id: 2 },
    update: {},
    create: { name: { ar: 'غذائي', en: 'Food' } },
  });
  const housingCategory = await prisma.category.upsert({
    where: { id: 3 },
    update: {},
    create: { name: { ar: 'سكني', en: 'Housing' } },
  });
  const educationCategory = await prisma.category.upsert({
    where: { id: 4 },
    update: {},
    create: { name: { ar: 'تعليمي', en: 'Education' } },
  });
  const smallProjectsCategory = await prisma.category.upsert({
    where: { id: 5 },
    update: {},
    create: { name: { ar: 'مشاريع صغيرة', en: 'Small Projects' } },
  });

  return {
    healthCategoryId: healthCategory.id,
    foodCategoryId: foodCategory.id,
    housingCategoryId: housingCategory.id,
    educationCategoryId: educationCategory.id,
    smallProjectsCategoryId: smallProjectsCategory.id,
  };
}
