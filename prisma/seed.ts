import { PrismaClient } from '@prisma/client';
import {
  BENEFICIARY_TEST_PASSWORD,
  seedBeneficiaries,
} from './seeds/beneficiaries.seed';
import { seedCategories } from './seeds/categories.seed';
import {
  DONOR_FINANCIAL_HISTORY_TEST_PASSWORD,
  seedDonorFinancialHistory,
} from './seeds/donor-financial-history.seed';
import { ensureSeedMediaFiles } from './seeds/media.seed';
import { seedPermissions } from './seeds/permissions.seed';
import { seedRequestAids } from './seeds/request-aids.seed';
import { seedRoles } from './seeds/roles.seed';
import { seedSubCategories } from './seeds/subcategories.seed';
import { seedAdminUser } from './seeds/users.seed';

const prisma = new PrismaClient();

async function main() {
  ensureSeedMediaFiles();

  const permissions = await seedPermissions(prisma);
  const roles = await seedRoles(prisma, permissions);
  await seedAdminUser(prisma, roles);

  const categories = await seedCategories(prisma);
  const subCategories = await seedSubCategories(prisma, categories);
  const beneficiaries = await seedBeneficiaries(prisma);
  const requestCount = await seedRequestAids(
    prisma,
    categories,
    subCategories,
    beneficiaries.acceptedBeneficiaries,
  );
  const donorFinancialHistoryAccounts = await seedDonorFinancialHistory(
    prisma,
    categories,
    beneficiaries.acceptedBeneficiaries,
  );

  console.log('\nSeeded beneficiary test accounts:');
  console.table(beneficiaries.accounts);
  console.log(
    `All seeded beneficiary passwords are "${BENEFICIARY_TEST_PASSWORD}".`,
  );
  console.log(
    `Seeded ${requestCount} assistance requests linked to accepted beneficiaries.`,
  );
  console.log('\nSeeded donor financial history test accounts:');
  console.table(donorFinancialHistoryAccounts);
  console.log(
    `All seeded donor financial history passwords are "${DONOR_FINANCIAL_HISTORY_TEST_PASSWORD}".`,
  );
  console.log('Run this seeder with: npm run seed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
