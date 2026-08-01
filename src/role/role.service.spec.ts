import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from './role.service';

describe('RoleService', () => {
  let service: RoleService;
  let prisma: any;
  let i18n: any;

  const createdAt = new Date('2026-07-31T12:00:00.000Z');
  const roleRecord = {
    id: 6,
    name: 'custom_manager',
    label: { ar: 'إدارة مخصصة', en: 'Custom Management' },
    createdAt,
    permissions: [
      { permission: { id: 1, name: 'read:roles' } },
      { permission: { id: 2, name: 'update:roles' } },
    ],
    users: [
      {
        user: {
          id: 7,
          firstName: 'Ahmad',
          lastName: 'Saleh',
        },
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      role: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
      userRole: {
        count: jest.fn(),
      },
      rolePermission: {},
      $transaction: jest.fn(),
    };
    i18n = {
      t: jest.fn((key: string, options?: any) => `${key}:${options?.lang ?? 'ar'}`),
    };

    service = new RoleService(prisma, i18n);
  });

  it('lists roles with createdAt', async () => {
    prisma.role.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'role_manager',
        label: { ar: 'إدارة الأدوار', en: 'Role Management' },
        createdAt,
      },
    ]);

    const result = await service.findAll('en');

    expect(prisma.role.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        label: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
    expect(result).toEqual([
      {
        id: 1,
        name: 'role_manager',
        label: 'Role Management',
        createdAt,
      },
    ]);
  });

  it('lists all permissions without labels', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { id: 1, name: 'read:roles' },
      { id: 2, name: 'create:roles' },
    ]);

    const result = await service.findAllPermissions();

    expect(prisma.permission.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
      },
      orderBy: { id: 'asc' },
    });
    expect(i18n.t).not.toHaveBeenCalledWith(
      expect.stringMatching(/^permissions\./),
      expect.anything(),
    );
    expect(result).toEqual([
      {
        id: 1,
        name: 'read:roles',
      },
      {
        id: 2,
        name: 'create:roles',
      },
    ]);
  });

  it('returns role detail with permissions and employees', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRecord);

    const result = await service.findOne('6', 'en');

    expect(prisma.role.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 6 },
        select: expect.objectContaining({
          permissions: expect.any(Object),
          users: expect.objectContaining({
            where: {
              user: {
                employee: { isNot: null },
              },
            },
          }),
        }),
      }),
    );
    expect(result).toEqual({
      id: 6,
      name: 'custom_manager',
      label: { ar: 'إدارة مخصصة', en: 'Custom Management' },
      createdAt,
      permissions: [
        { id: 1, name: 'read:roles' },
        { id: 2, name: 'update:roles' },
      ],
      employees: [{ userId: 7, firstName: 'Ahmad', lastName: 'Saleh' }],
    });
  });

  it('rejects invalid IDs and missing roles', async () => {
    await expect(service.findOne('abc', 'en')).rejects.toThrow(
      BadRequestException,
    );
    expect(i18n.t).toHaveBeenCalledWith('role.INVALID_ID', { lang: 'en' });

    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.findOne('404', 'en')).rejects.toThrow(
      NotFoundException,
    );
    expect(i18n.t).toHaveBeenCalledWith('role.NOT_FOUND', { lang: 'en' });
  });

  it('rejects duplicate role names on create', async () => {
    prisma.role.findFirst.mockResolvedValue({ id: 1 });

    await expect(
      service.create(
        {
          label: { ar: 'مخصص', en: 'Custom' },
          permissionIds: [1],
        },
        'en',
      ),
    ).rejects.toThrow(ConflictException);
    expect(i18n.t).toHaveBeenCalledWith('role.NAME_ALREADY_EXISTS', {
      lang: 'en',
    });
  });

  it('rejects missing permission IDs on create', async () => {
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.permission.findMany.mockResolvedValue([{ id: 1 }]);

    await expect(
      service.create(
        {
          label: { ar: 'مخصص', en: 'Custom' },
          permissionIds: [1, 99],
        },
        'en',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(i18n.t).toHaveBeenCalledWith('role.SOME_PERMISSIONS_NOT_FOUND', {
      lang: 'en',
    });
  });

  it('rejects create when label.en cannot generate a role name', async () => {
    await expect(
      service.create(
        {
          label: { ar: 'غير صالح', en: '!!!' },
          permissionIds: [1],
        },
        'en',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(i18n.t).toHaveBeenCalledWith('role.NAME_REQUIRED', { lang: 'en' });
  });

  it('creates role and role permissions inside a transaction', async () => {
    const tx = {
      role: {
        create: jest.fn().mockResolvedValue({ id: 6 }),
        findUnique: jest.fn().mockResolvedValue(roleRecord),
      },
    };
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.permission.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));

    const result = await service.create(
      {
        label: { ar: 'إدارة مخصصة', en: 'Custom Management' },
        permissionIds: [1, 2, 2],
      },
      'en',
    );

    expect(tx.role.create).toHaveBeenCalledWith({
      data: {
        name: 'custom_management',
        label: { ar: 'إدارة مخصصة', en: 'Custom Management' },
        permissions: {
          create: [{ permissionId: 1 }, { permissionId: 2 }],
        },
      },
      select: { id: true },
    });
    expect(result.id).toBe(6);
  });

  it('replaces role permissions during update when permissionIds is provided', async () => {
    const tx = {
      role: {
        update: jest.fn().mockResolvedValue({ id: 6 }),
        findUnique: jest.fn().mockResolvedValue(roleRecord),
      },
      rolePermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    prisma.role.findUnique.mockResolvedValue({ id: 6 });
    prisma.permission.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));

    await service.update(
      '6',
      {
        label: { ar: 'تحديث', en: 'Updated' },
        permissionIds: [1, 2],
      },
      'en',
    );

    expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 6 },
    });
    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: {
        label: { ar: 'تحديث', en: 'Updated' },
      },
    });
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 6, permissionId: 1 },
        { roleId: 6, permissionId: 2 },
      ],
    });
  });

  it('rejects deletion when role is assigned to employees with count', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 6,
      name: 'custom_manager',
    });
    prisma.userRole.count.mockResolvedValue(2);

    await expect(service.remove('6', 'en')).rejects.toMatchObject({
      response: {
        message: 'role.ROLE_ASSIGNED_TO_EMPLOYEES:en',
        assignedEmployeesCount: 2,
      },
    });
  });

  it('rejects protected seeded roles', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 6,
      name: 'role_manager',
    });

    await expect(service.remove('6', 'en')).rejects.toThrow(ConflictException);
    expect(prisma.userRole.count).not.toHaveBeenCalled();
  });

  it('deletes an unused role', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 6,
      name: 'custom_manager',
    });
    prisma.userRole.count.mockResolvedValue(0);
    prisma.role.delete.mockResolvedValue({ id: 6 });

    const result = await service.remove('6', 'en');

    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 6 } });
    expect(result).toEqual({
      success: true,
      message: 'role.DELETE_SUCCESS:en',
    });
  });
});
