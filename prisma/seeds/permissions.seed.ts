import { PrismaClient } from '@prisma/client';
import { PermissionMap } from './seed.types';

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
  { name: 'read:aid_requests' },
  { name: 'read:roles' },
  { name: 'create:roles' },
  { name: 'update:roles' },
  { name: 'delete:roles' },
];

export async function seedPermissions(
  prisma: PrismaClient,
): Promise<PermissionMap> {
  const permissions: PermissionMap = {};

  for (const permissionData of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: { name: permissionData.name },
      update: {},
      create: permissionData,
    });

    permissions[permission.name] = permission;
  }

  return permissions;
}
