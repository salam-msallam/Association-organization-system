import { PrismaClient } from '@prisma/client';
import { seedBeneficiaries } from './seeds/beneficiaries.seed';
import { seedCategories } from './seeds/categories.seed';
import { seedDonorFinancialHistory } from './seeds/donor-financial-history.seed';
import { ensureSeedMediaFiles } from './seeds/media.seed';
import { seedPermissions } from './seeds/permissions.seed';
import { seedRequestAids } from './seeds/request-aids.seed';
import { seedRoles } from './seeds/roles.seed';
import { seedSponsorshipEmergencyCoverage } from './seeds/sponsorship-emergency-coverage.seed';
import { seedSubCategories } from './seeds/subcategories.seed';
import { seedAdminUser } from './seeds/users.seed';

const prisma = new PrismaClient();

const seedName = process.argv[2];

async function main() {
  if (!seedName) {
    throw new Error(
      'Missing seed name. Example: npm run seed:one roles',
    );
  }

  ensureSeedMediaFiles();

  switch (seedName) {
    case 'permissions':
      await seedPermissions(prisma);
      break;

    case 'roles': {
      const permissions = await seedPermissions(prisma);
      await seedRoles(prisma, permissions);
      break;
    }

    case 'admin':
    case 'users': {
      const permissions = await seedPermissions(prisma);
      const roles = await seedRoles(prisma, permissions);
      await seedAdminUser(prisma, roles);
      break;
    }

    case 'categories':
      await seedCategories(prisma);
      break;

    case 'subcategories': {
      const categories = await seedCategories(prisma);
      await seedSubCategories(prisma, categories);
      break;
    }

    case 'beneficiaries':
      await seedBeneficiaries(prisma);
      break;

    case 'request-aids': {
      const categories = await seedCategories(prisma);
      const subCategories = await seedSubCategories(prisma, categories);
      const beneficiaries = await seedBeneficiaries(prisma);
      await seedRequestAids(
        prisma,
        categories,
        subCategories,
        beneficiaries.acceptedBeneficiaries,
      );
      break;
    }

    case 'donor-financial-history': {
      const categories = await seedCategories(prisma);
      const beneficiaries = await seedBeneficiaries(prisma);
      await seedDonorFinancialHistory(
        prisma,
        categories,
        beneficiaries.acceptedBeneficiaries,
      );
      break;
    }

    case 'sponsorship-emergency-coverage':
      await seedSponsorshipEmergencyCoverage(prisma);
      break;

    default:
      throw new Error(
        `Unknown seed "${seedName}". Available seeds: permissions, roles, admin, users, categories, subcategories, beneficiaries, request-aids, donor-financial-history, sponsorship-emergency-coverage`,
      );
  }

  console.log(`Seed "${seedName}" completed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
