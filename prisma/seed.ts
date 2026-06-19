import { PrismaClient, UserType, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password', 10);

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
    update: {},
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

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });