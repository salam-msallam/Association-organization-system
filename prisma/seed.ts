import {
  Gender,
  Prisma,
  PrismaClient,
  SocialStatus,
  Status,
  UserType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const BENEFICIARY_TEST_PASSWORD = '12345678';
const BENEFICIARY_UPLOADS_DIR = path.join(
  process.cwd(),
  'uploads',
  'beneficiaries',
);
const TEST_FAMILY_STATEMENT_PATH =
  'uploads/beneficiaries/test-family-statement.pdf';
const TEST_PERSONAL_PHOTO_PATH = 'uploads/beneficiaries/test-personal-photo.png';

function ensureBeneficiaryPlaceholderFiles() {
  fs.mkdirSync(BENEFICIARY_UPLOADS_DIR, { recursive: true });

  const familyStatementFullPath = path.join(
    process.cwd(),
    TEST_FAMILY_STATEMENT_PATH,
  );
  const personalPhotoFullPath = path.join(
    process.cwd(),
    TEST_PERSONAL_PHOTO_PATH,
  );

  if (!fs.existsSync(familyStatementFullPath)) {
    fs.writeFileSync(
      familyStatementFullPath,
      Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
        'utf8',
      ),
    );
  }

  if (!fs.existsSync(personalPhotoFullPath)) {
    fs.writeFileSync(
      personalPhotoFullPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        'base64',
      ),
    );
  }
}

const beneficiarySeedData = Array.from({ length: 15 }, (_, index) => {
  const accountNumber = index + 1;
  const statuses = [
    ...Array(7).fill(Status.PENDING),
    ...Array(5).fill(Status.ACCEPTED),
    ...Array(3).fill(Status.REJECTED),
  ] as Status[];
  const socialStatuses = [
    SocialStatus.SINGLE,
    SocialStatus.MARRIED,
    SocialStatus.WIDOWED,
    SocialStatus.DIVORCED,
  ];
  const socialStatus = socialStatuses[index % socialStatuses.length];
  const isUnemployed = accountNumber % 3 === 0;
  const status = statuses[index];

  return {
    firstName: `Beneficiary${accountNumber}`,
    lastName: 'Test',
    email: `beneficiary${accountNumber}@test.com`,
    number: `9900000${accountNumber.toString().padStart(2, '0')}`,
    countryName: 'Syria',
    countryCode: '+963',
    gender: accountNumber % 2 === 0 ? Gender.FEMALE : Gender.MALE,
    socialStatus,
    numberOfChildren:
      socialStatus === SocialStatus.SINGLE ? null : (index % 5) + 1,
    isUnemployed,
    monthlyIncome: isUnemployed ? 0 : [250, 400, 650, 800][index % 4],
    status,
    address: {
      ar: `دمشق - منطقة اختبار ${accountNumber}`,
      en: `Damascus - Test Area ${accountNumber}`,
    },
    rejectionReason:
      status === Status.REJECTED
        ? {
            ar: 'بيانات التسجيل غير مكتملة.',
            en: 'Registration information is incomplete.',
          }
        : null,
  };
});

async function main() {
  const hashedPassword = await bcrypt.hash('password', 10);
  const beneficiaryHashedPassword = await bcrypt.hash(
    BENEFICIARY_TEST_PASSWORD,
    10,
  );

  const permissionsData = [
    { name: 'read:orphans' },
    { name: 'create:orphans' },
    { name: 'update:orphans' },
    { name: 'delete:orphans' },
    
    { name: 'read:employees' },
    { name: 'create:employees' },
    { name: 'update:employees' },
    { name: 'delete:employees' },

    { name: 'read:donors' },

    { name: 'read:beneficiaries' },
    { name: 'status:beneficiaries' }, 
    { name: 'status:aid_requests' },  

    { name: 'read:roles' },
    { name: 'create:roles' },
    { name: 'update:roles' },
    { name: 'delete:roles' },
  ];

  const permissions: Record<string, any> = {};
  
  for (const p of permissionsData) {
    const createdPermission = await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
    permissions[p.name] = createdPermission;
  }

    const orphanManagerRole = await prisma.role.upsert({
    where: { name: 'orphan_manager' },
    update: {
      permissions: {
        deleteMany: {},
        create: [
          { permissionId: permissions['read:orphans'].id },
          { permissionId: permissions['create:orphans'].id },
          { permissionId: permissions['update:orphans'].id },
          { permissionId: permissions['delete:orphans'].id },
        ],
      },
    },
    create: {
      name: 'orphan_manager',
      label: { ar: 'إدارة الأيتام', en: 'Orphan Management' },
      permissions: {
        create: [
          { permissionId: permissions['read:orphans'].id },
          { permissionId: permissions['create:orphans'].id },
          { permissionId: permissions['update:orphans'].id },
          { permissionId: permissions['delete:orphans'].id },
        ],
      },
    },
  });

  const employeeManagerRole = await prisma.role.upsert({
    where: { name: 'employee_manager' },
    update: {},
    create: {
      name: 'employee_manager',
      label: { ar: 'إدارة الموظفين', en: 'Employee Management' },
      permissions: {
        create: [
          { permissionId: permissions['read:employees'].id },
          { permissionId: permissions['create:employees'].id },
          { permissionId: permissions['update:employees'].id },
          { permissionId: permissions['delete:employees'].id },
        ],
      },
    },
  });

  const donorReaderRole = await prisma.role.upsert({
    where: { name: 'donor_reader' },
    update: {},
    create: {
      name: 'donor_reader',
      label: { ar: 'قراءة المتبرعين', en: 'Donor Reader' },
      permissions: {
        create: [
          { permissionId: permissions['read:donors'].id },
        ],
      },
    },
  });

  const beneficiaryManagerRole = await prisma.role.upsert({
    where: { name: 'beneficiary_manager' },
    update: {},
    create: {
      name: 'beneficiary_manager',
      label: { ar: 'إدارة المستفيدين وطلباتهم', en: 'Beneficiaries Management' },
      permissions: {
        create: [
          { permissionId: permissions['read:beneficiaries'].id },
          { permissionId: permissions['status:beneficiaries'].id },
          { permissionId: permissions['status:aid_requests'].id },
        ],
      },
    },
  });

  const roleManagerRole = await prisma.role.upsert({
    where: { name: 'role_manager' },
    update: {},
    create: {
      name: 'role_manager',
      label: { ar: 'إدارة الأدوار', en: 'Role Management' },
      permissions: {
        create: [
          { permissionId: permissions['read:roles'].id },
          { permissionId: permissions['create:roles'].id },
          { permissionId: permissions['update:roles'].id },
          { permissionId: permissions['delete:roles'].id },
        ],
      },
    },
  });

  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      firstName: 'admin',
      lastName: 'admin',
      email: 'admin@gmail.com',
      password: hashedPassword, 
      number: '123456789',
      countryName: 'Syria',
      countryCode: '963',
      gender: Gender.MALE,
      userType: UserType.ADMIN,
      roles: {
        create: [
          { roleId: employeeManagerRole.id },
          { roleId: donorReaderRole.id },
          { roleId: roleManagerRole.id },
        ],
      },
    },
  });

  // ==========================================================
  // 🌱 Categories & SubCategories (ثابتة - Seed فقط)
  // ==========================================================

  const healthCategory = await prisma.category.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: { ar: 'صحي', en: 'Health' },
    },
  });

  const foodCategory = await prisma.category.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: { ar: 'غذائي', en: 'Food' },
    },
  });

  const housingCategory = await prisma.category.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: { ar: 'سكني', en: 'Housing' },
    },
  });

  const educationCategory = await prisma.category.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: { ar: 'تعليمي', en: 'Education' },
    },
  });

  const smallProjectsCategory = await prisma.category.upsert({
    where: { id: 5 },
    update: {},
    create: {
      name: { ar: 'مشاريع صغيرة', en: 'Small Projects' },
    },
  });


  // SubCategory - فقط تحت "سكني"
  await prisma.subCategory.upsert({
    where: { id: 1 },
    update: {},
    create: {
      categoryId: housingCategory.id,
      name: { ar: 'تأمين منزل', en: 'Home Insurance' },
    },
  });

  await prisma.subCategory.upsert({
    where: { id: 2 },
    update: {},
    create: {
      categoryId: housingCategory.id,
      name: { ar: 'مساعدة في إيجار البيت', en: 'Rent Assistance' },
    },
  });

  await prisma.subCategory.upsert({
    where: { id: 3 },
    update: {},
    create: {
      categoryId: housingCategory.id,
      name: { ar: 'إصلاحات منزلية', en: 'Home Repairs' },
    },
  });

  ensureBeneficiaryPlaceholderFiles();

  const seededBeneficiaryAccounts: Array<{
    email: string;
    password: string;
    status: Status;
  }> = [];

  for (const beneficiaryData of beneficiarySeedData) {
    const user = await prisma.user.upsert({
      where: { email: beneficiaryData.email },
      update: {
        firstName: beneficiaryData.firstName,
        lastName: beneficiaryData.lastName,
        password: beneficiaryHashedPassword,
        number: beneficiaryData.number,
        countryName: beneficiaryData.countryName,
        countryCode: beneficiaryData.countryCode,
        gender: beneficiaryData.gender,
        userType: UserType.BENEFICIARY,
      },
      create: {
        firstName: beneficiaryData.firstName,
        lastName: beneficiaryData.lastName,
        email: beneficiaryData.email,
        password: beneficiaryHashedPassword,
        number: beneficiaryData.number,
        countryName: beneficiaryData.countryName,
        countryCode: beneficiaryData.countryCode,
        gender: beneficiaryData.gender,
        userType: UserType.BENEFICIARY,
      },
    });

    await prisma.beneficiary.upsert({
      where: { userId: user.id },
      update: {
        personalPhoto: TEST_PERSONAL_PHOTO_PATH,
        familyStatement: TEST_FAMILY_STATEMENT_PATH,
        address: beneficiaryData.address,
        status: beneficiaryData.status,
        rejectionReason: beneficiaryData.rejectionReason ?? Prisma.JsonNull,
        socialStatus: beneficiaryData.socialStatus,
        numberOfChildren: beneficiaryData.numberOfChildren,
        isUnemployed: beneficiaryData.isUnemployed,
        monthlyIncome: beneficiaryData.monthlyIncome,
      },
      create: {
        userId: user.id,
        personalPhoto: TEST_PERSONAL_PHOTO_PATH,
        familyStatement: TEST_FAMILY_STATEMENT_PATH,
        address: beneficiaryData.address,
        status: beneficiaryData.status,
        rejectionReason: beneficiaryData.rejectionReason ?? Prisma.JsonNull,
        socialStatus: beneficiaryData.socialStatus,
        numberOfChildren: beneficiaryData.numberOfChildren,
        isUnemployed: beneficiaryData.isUnemployed,
        monthlyIncome: beneficiaryData.monthlyIncome,
      },
    });

    seededBeneficiaryAccounts.push({
      email: beneficiaryData.email,
      password: BENEFICIARY_TEST_PASSWORD,
      status: beneficiaryData.status,
    });
  }

  console.log('\nSeeded beneficiary test accounts:');
  console.table(seededBeneficiaryAccounts);
  console.log(
    `All seeded beneficiary passwords are "${BENEFICIARY_TEST_PASSWORD}".`,
  );
  console.log('Run this seeder with: npm run seed');
 
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
