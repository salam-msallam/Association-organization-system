import { PrismaClient } from '@prisma/client';
import { PermissionMap, SeededRoles } from './seed.types';

export const ADMIN_PERMISSION_NAMES = [
  'create:employees',
  'delete:employees',
  'read:employees',
  'update:employees',
  'create:roles',
  'delete:roles',
  'read:roles',
  'update:roles',
  'read:aid_requests',
  'read:beneficiaries',
  'read:donors',
  'read:orphans',
  'read:quick_aid_fund',
  'read:sponsorship_fund',
  'read:sponsorships',
] as const;

export async function seedRoles(
  prisma: PrismaClient,
  permissions: PermissionMap,
): Promise<SeededRoles> {
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {
      label: { ar: 'مدير النظام', en: 'System Administrator' },
      permissions: {
        deleteMany: {},
        create: permissionLinks(permissions, ADMIN_PERMISSION_NAMES),
      },
    },
    create: {
      name: 'admin',
      label: { ar: 'مدير النظام', en: 'System Administrator' },
      permissions: {
        create: permissionLinks(permissions, ADMIN_PERMISSION_NAMES),
      },
    },
  });

  await prisma.role.upsert({
    where: { name: 'orphan_manager' },
    update: {
      permissions: {
        deleteMany: {},
        create: permissionLinks(permissions, [
          'read:orphans',
          'create:orphans',
          'update:orphans',
          'delete:orphans',
        ]),
      },
    },
    create: {
      name: 'orphan_manager',
      label: { ar: 'إدارة الأيتام', en: 'Orphan Management' },
      permissions: {
        create: permissionLinks(permissions, [
          'read:orphans',
          'create:orphans',
          'update:orphans',
          'delete:orphans',
        ]),
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
        create: permissionLinks(permissions, [
          'read:employees',
          'create:employees',
          'update:employees',
          'delete:employees',
        ]),
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
        create: permissionLinks(permissions, ['read:donors']),
      },
    },
  });

  await prisma.role.upsert({
    where: { name: 'beneficiary_manager' },
    update: {
      permissions: {
        deleteMany: {},
        create: permissionLinks(permissions, [
          'read:beneficiaries',
          'create::beneficiaries',
          'status:beneficiaries',
          'status:aid_requests',
          'read:aid_requests',
        ]),
      },
    },
    create: {
      name: 'beneficiary_manager',
      label: {
        ar: 'إدارة المستفيدين وطلباتهم',
        en: 'Beneficiaries Management',
      },
      permissions: {
        create: permissionLinks(permissions, [
          'read:beneficiaries',
          'create::beneficiaries',
          'status:beneficiaries',
          'status:aid_requests',
          'read:aid_requests',
        ]),
      },
    },
  });

  const aidRequestManagerRole = await prisma.role.upsert({
    where: { name: 'aid_request_manager' },
    update: {
      label: {
        ar: 'إدارة طلبات الإعانة',
        en: 'Aid Request Management',
      },
      permissions: {
        deleteMany: {},
        create: permissionLinks(permissions, [
          'status:aid_requests',
          'read:aid_requests',
          'create::aid-requests',
        ]),
      },
    },
    create: {
      name: 'aid_request_manager',
      label: {
        ar: 'إدارة طلبات الإعانة',
        en: 'Aid Request Management',
      },
      permissions: {
        create: permissionLinks(permissions, [
          'status:aid_requests',
          'read:aid_requests',
          'create::aid-requests',
        ]),
      },
    },
  });

  const sponsorshipManagerRole = await prisma.role.upsert({
    where: { name: 'sponsorship_manager' },
    update: {
      label: {
        ar: 'إدارة الكفالات',
        en: 'Sponsorship Management',
      },
      permissions: {
        deleteMany: {},
        create: permissionLinks(permissions, [
          'read:sponsorships',
          'read:sponsorship_fund',
          'status:sponsorships',
          'read:orphans',
          'update:orphans',
          'create:annual_reports',
        ]),
      },
    },
    create: {
      name: 'sponsorship_manager',
      label: {
        ar: 'إدارة الكفالات',
        en: 'Sponsorship Management',
      },
      permissions: {
        create: permissionLinks(permissions, [
          'read:sponsorships',
          'read:sponsorship_fund',
          'status:sponsorships',
          'read:orphans',
          'update:orphans',
          'create:annual_reports',
        ]),
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
        create: permissionLinks(permissions, [
          'read:roles',
          'create:roles',
          'update:roles',
          'delete:roles',
        ]),
      },
    },
  });

  await prisma.role.upsert({
    where: { name: 'quick_aid_fund_manager' },
    update: {
      label: {
        ar: 'إدارة صندوق المساعدات العاجلة',
        en: 'Quick Aid Fund Management',
      },
      permissions: {
        deleteMany: {},
        create: permissionLinks(permissions, [
          'read:quick_aid_fund',
          'create:quick_aid_disbursements',
        ]),
      },
    },
    create: {
      name: 'quick_aid_fund_manager',
      label: {
        ar: 'إدارة صندوق المساعدات العاجلة',
        en: 'Quick Aid Fund Management',
      },
      permissions: {
        create: permissionLinks(permissions, [
          'read:quick_aid_fund',
          'create:quick_aid_disbursements',
        ]),
      },
    },
  });

  return {
    adminRole,
    employeeManagerRole,
    donorReaderRole,
    roleManagerRole,
    aidRequestManagerRole,
    sponsorshipManagerRole,
  };
}

function permissionLinks(permissions: PermissionMap, names: readonly string[]) {
  return names.map((name) => ({ permissionId: permissions[name].id }));
}
