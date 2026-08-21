import { Gender, PrismaClient, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SeededRoles } from './seed.types';

export async function seedAdminUser(prisma: PrismaClient, roles: SeededRoles) {
  const hashedPassword = await bcrypt.hash('password', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      password: hashedPassword,
      number: '123456789',
      countryCode: '+963',
      userType: UserType.ADMIN,
    },
    create: {
      firstName: 'admin',
      lastName: 'admin',
      email: 'admin@gmail.com',
      password: hashedPassword,
      number: '123456789',
      countryName: 'Syria',
      countryCode: '+963',
      gender: Gender.MALE,
      userType: UserType.ADMIN,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: adminUser.id } });
    await tx.userRole.create({
      data: { userId: adminUser.id, roleId: roles.adminRole.id },
    });
  });

  return adminUser;
}
