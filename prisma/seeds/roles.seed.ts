import { PrismaClient } from '@prisma/client';
import { PermissionMap, SeededRoles } from './seed.types';

export async function seedRoles(
  prisma: PrismaClient,
  permissions: PermissionMap,
): Promise<SeededRoles> {
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

  return {
    employeeManagerRole,
    donorReaderRole,
    roleManagerRole,
    aidRequestManagerRole,
  };
}

function permissionLinks(permissions: PermissionMap, names: string[]) {
  return names.map((name) => ({ permissionId: permissions[name].id }));
}
