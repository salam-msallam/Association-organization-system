import { Gender, PrismaClient, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SeededRoles } from './seed.types';

export async function seedAdminUser(prisma: PrismaClient, roles: SeededRoles) {
  const hashedPassword = await bcrypt.hash('password', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: { password: hashedPassword },
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
          { roleId: roles.employeeManagerRole.id },
          { roleId: roles.donorReaderRole.id },
          { roleId: roles.roleManagerRole.id },
          { roleId: roles.aidRequestManagerRole.id },
        ],
      },
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: adminUser.id, roleId: roles.employeeManagerRole.id },
      { userId: adminUser.id, roleId: roles.donorReaderRole.id },
      { userId: adminUser.id, roleId: roles.roleManagerRole.id },
      { userId: adminUser.id, roleId: roles.aidRequestManagerRole.id },
    ],
    skipDuplicates: true,
  });

  return adminUser;
}
