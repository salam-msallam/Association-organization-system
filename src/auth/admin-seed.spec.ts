import { UserType } from '@prisma/client';
import { ADMIN_PERMISSION_NAMES } from '../../prisma/seeds/roles.seed';
import { seedAdminUser } from '../../prisma/seeds/users.seed';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('admin seed', () => {
  it('defines the exact permission set required by the admin role', () => {
    expect(ADMIN_PERMISSION_NAMES).toEqual([
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
    ]);
    expect(new Set(ADMIN_PERMISSION_NAMES).size).toBe(15);
  });

  it('replaces existing assignments with only the admin role on every run', async () => {
    const adminUser = { id: 11, email: 'admin@gmail.com' };
    const tx = {
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
        create: jest.fn().mockResolvedValue({ userId: 11, roleId: 3 }),
      },
    };
    const prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue(adminUser),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const roles = { adminRole: { id: 3 } };

    await seedAdminUser(prisma as any, roles as any);
    await seedAdminUser(prisma as any, roles as any);

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@gmail.com' },
        update: expect.objectContaining({ userType: UserType.ADMIN }),
        create: expect.not.objectContaining({ roles: expect.anything() }),
      }),
    );
    expect(tx.userRole.deleteMany).toHaveBeenCalledTimes(2);
    expect(tx.userRole.deleteMany).toHaveBeenLastCalledWith({
      where: { userId: 11 },
    });
    expect(tx.userRole.create).toHaveBeenCalledTimes(2);
    expect(tx.userRole.create).toHaveBeenLastCalledWith({
      data: { userId: 11, roleId: 3 },
    });
  });
});
