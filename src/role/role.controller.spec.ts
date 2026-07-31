import { RoleController } from './role.controller';

describe('RoleController', () => {
  let controller: RoleController;
  let roleService: any;
  let i18n: any;

  const role = {
    id: 6,
    name: 'custom_manager',
    label: 'Custom Management',
    createdAt: new Date('2026-07-31T12:00:00.000Z'),
    permissions: [{ id: 1, name: 'read:roles' }],
    employees: [{ userId: 7, firstName: 'Ahmad', lastName: 'Saleh' }],
  };

  beforeEach(() => {
    roleService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    i18n = {
      t: jest.fn((key: string, options?: any) => `${key}:${options?.lang ?? 'ar'}`),
    };

    controller = new RoleController(roleService, i18n);
  });

  it('wraps role list responses with localized messages', async () => {
    roleService.findAll.mockResolvedValue([role]);

    await expect(controller.findAll('en')).resolves.toEqual({
      success: true,
      message: 'role.FETCH_SUCCESS:en',
      data: [role],
    });
  });

  it('delegates role detail lookup and wraps the response', async () => {
    roleService.findOne.mockResolvedValue(role);

    await expect(controller.findOne('6', 'en')).resolves.toEqual({
      success: true,
      message: 'role.FETCH_ONE_SUCCESS:en',
      data: role,
    });
    expect(roleService.findOne).toHaveBeenCalledWith('6', 'en');
  });

  it('delegates role creation and wraps the response', async () => {
    const dto = {
      name: 'custom_manager',
      label: { ar: 'إدارة مخصصة', en: 'Custom Management' },
      permissionIds: [1],
    };
    roleService.create.mockResolvedValue(role);

    await expect(controller.create(dto, 'en')).resolves.toEqual({
      success: true,
      message: 'role.CREATE_SUCCESS:en',
      data: role,
    });
    expect(roleService.create).toHaveBeenCalledWith(dto, 'en');
  });

  it('delegates role updates and wraps the response', async () => {
    const dto = { permissionIds: [1] };
    roleService.update.mockResolvedValue(role);

    await expect(controller.update('6', dto, 'en')).resolves.toEqual({
      success: true,
      message: 'role.UPDATE_SUCCESS:en',
      data: role,
    });
    expect(roleService.update).toHaveBeenCalledWith('6', dto, 'en');
  });

  it('delegates role deletion', async () => {
    roleService.remove.mockResolvedValue({
      success: true,
      message: 'role.DELETE_SUCCESS:en',
    });

    await expect(controller.remove('6', 'en')).resolves.toEqual({
      success: true,
      message: 'role.DELETE_SUCCESS:en',
    });
    expect(roleService.remove).toHaveBeenCalledWith('6', 'en');
  });
});
