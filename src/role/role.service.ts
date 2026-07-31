import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, RoleResponseDto, UpdateRoleDto } from './dto/role.dto';

const PROTECTED_SYSTEM_ROLE_NAMES = new Set([
  'orphan_manager',
  'employee_manager',
  'donor_reader',
  'beneficiary_manager',
  'aid_request_manager',
  'role_manager',
]);

type RoleWithRelations = {
  id: number;
  name: string;
  label: Prisma.JsonValue;
  createdAt: Date;
  permissions: {
    permission: {
      id: number;
      name: string;
    };
  }[];
  users: {
    user: {
      id: number;
      firstName: string;
      lastName: string;
    };
  }[];
};

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async findAll(lang = 'ar') {
    const roles = await this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        label: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });

    return roles.map((role) => ({
      ...role,
      label: this.localizeJsonText(role.label, lang),
    }));
  }

  async findOne(id: string | number, lang = 'ar'): Promise<RoleResponseDto> {
    const roleId = this.parseRoleId(id, lang);
    const role = await this.findRoleWithRelations(roleId);

    if (!role) {
      throw new NotFoundException(this.i18n.t('role.NOT_FOUND', { lang }));
    }

    return this.mapRoleDetail(role, lang);
  }

  async create(
    createRoleDto: CreateRoleDto,
    lang = 'ar',
  ): Promise<RoleResponseDto> {
    const name = this.normalizeRoleName(createRoleDto.name, lang);
    const permissionIds = this.uniqueIds(createRoleDto.permissionIds);

    await this.ensureRoleNameIsAvailable(name, undefined, lang);
    await this.ensurePermissionsExist(permissionIds, lang);

    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          name,
          label: this.toInputJson(createRoleDto.label),
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
        select: { id: true },
      });

      return tx.role.findUnique({
        where: { id: createdRole.id },
        ...this.roleDetailQuery,
      });
    });

    return this.mapRoleDetail(role as RoleWithRelations, lang);
  }

  async update(
    id: string | number,
    updateRoleDto: UpdateRoleDto,
    lang = 'ar',
  ): Promise<RoleResponseDto> {
    const roleId = this.parseRoleId(id, lang);
    const existingRole = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!existingRole) {
      throw new NotFoundException(this.i18n.t('role.NOT_FOUND', { lang }));
    }

    const name =
      updateRoleDto.name !== undefined
        ? this.normalizeRoleName(updateRoleDto.name, lang)
        : undefined;
    const permissionIds =
      updateRoleDto.permissionIds !== undefined
        ? this.uniqueIds(updateRoleDto.permissionIds)
        : undefined;

    if (name !== undefined) {
      await this.ensureRoleNameIsAvailable(name, roleId, lang);
    }

    if (permissionIds !== undefined) {
      await this.ensurePermissionsExist(permissionIds, lang);
    }

    const role = await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          ...(name !== undefined && { name }),
          ...(updateRoleDto.label !== undefined && {
            label: this.toInputJson(updateRoleDto.label),
          }),
        },
      });

      if (permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId,
              permissionId,
            })),
          });
        }
      }

      return tx.role.findUnique({
        where: { id: roleId },
        ...this.roleDetailQuery,
      });
    });

    return this.mapRoleDetail(role as RoleWithRelations, lang);
  }

  async remove(id: string | number, lang = 'ar') {
    const roleId = this.parseRoleId(id, lang);
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new NotFoundException(this.i18n.t('role.NOT_FOUND', { lang }));
    }

    if (PROTECTED_SYSTEM_ROLE_NAMES.has(role.name)) {
      throw new ConflictException(
        this.i18n.t('role.PROTECTED_ROLE_CANNOT_BE_DELETED', { lang }),
      );
    }

    const assignedEmployeesCount = await this.prisma.userRole.count({
      where: {
        roleId,
        user: {
          employee: { isNot: null },
        },
      },
    });

    if (assignedEmployeesCount > 0) {
      throw new ConflictException({
        message: this.i18n.t('role.ROLE_ASSIGNED_TO_EMPLOYEES', { lang }),
        assignedEmployeesCount,
      });
    }

    try {
      await this.prisma.role.delete({ where: { id: roleId } });
    } catch (error) {
      this.handlePrismaError(error, lang);
    }

    return {
      success: true,
      message: this.i18n.t('role.DELETE_SUCCESS', { lang }),
    };
  }

  private readonly roleDetailQuery = {
    select: {
      id: true,
      name: true,
      label: true,
      createdAt: true,
      permissions: {
        select: {
          permission: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { permissionId: 'asc' as const },
      },
      users: {
        where: {
          user: {
            employee: { isNot: null },
          },
        },
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { userId: 'asc' as const },
      },
    },
  };

  private async findRoleWithRelations(
    roleId: number,
  ): Promise<RoleWithRelations | null> {
    return this.prisma.role.findUnique({
      where: { id: roleId },
      ...this.roleDetailQuery,
    }) as Promise<RoleWithRelations | null>;
  }

  private parseRoleId(id: string | number, lang: string): number {
    const isValidString = typeof id !== 'string' || /^\d+$/.test(id.trim());
    const roleId = typeof id === 'number' ? id : Number(id);

    if (!isValidString || !Number.isInteger(roleId) || roleId <= 0) {
      throw new BadRequestException(this.i18n.t('role.INVALID_ID', { lang }));
    }

    return roleId;
  }

  private normalizeRoleName(name: string, lang: string): string {
    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new BadRequestException(this.i18n.t('role.NAME_REQUIRED', { lang }));
    }

    return normalizedName;
  }

  private uniqueIds(ids: number[]): number[] {
    return Array.from(new Set(ids));
  }

  private async ensureRoleNameIsAvailable(
    name: string,
    currentRoleId: number | undefined,
    lang: string,
  ): Promise<void> {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        name,
        ...(currentRoleId !== undefined && { NOT: { id: currentRoleId } }),
      },
      select: { id: true },
    });

    if (existingRole) {
      throw new ConflictException(
        this.i18n.t('role.NAME_ALREADY_EXISTS', { lang }),
      );
    }
  }

  private async ensurePermissionsExist(
    permissionIds: number[],
    lang: string,
  ): Promise<void> {
    if (permissionIds.length === 0) return;

    const existingPermissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });

    if (existingPermissions.length !== permissionIds.length) {
      throw new BadRequestException(
        this.i18n.t('role.SOME_PERMISSIONS_NOT_FOUND', { lang }),
      );
    }
  }

  private mapRoleDetail(role: RoleWithRelations, lang: string): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      label: this.localizeJsonText(role.label, lang),
      createdAt: role.createdAt,
      permissions: role.permissions.map(({ permission }) => permission),
      employees: role.users.map(({ user }) => ({
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      })),
    };
  }

  private toInputJson(label: CreateRoleDto['label']): Prisma.InputJsonObject {
    return {
      ar: label.ar,
      en: label.en,
    };
  }

  private localizeJsonText(value: Prisma.JsonValue, lang: string): string {
    if (typeof value === 'string') {
      try {
        return this.localizeJsonText(JSON.parse(value), lang);
      } catch {
        return value;
      }
    }

    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return '';
    }

    const supportedLanguage = lang.toLowerCase().startsWith('en') ? 'en' : 'ar';
    const record = value as Record<string, Prisma.JsonValue>;
    const translated =
      record[supportedLanguage] ?? record.ar ?? record.en ?? null;

    return typeof translated === 'string' ? translated : '';
  }

  private handlePrismaError(error: unknown, lang: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(this.i18n.t('role.NOT_FOUND', { lang }));
    }

    throw error;
  }
}
