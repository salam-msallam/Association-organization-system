import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { I18nLang, I18nService } from 'nestjs-i18n';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { PreserveLabelResponse } from '../decorators/preserve-label-response.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import {
  CreateRoleDto,
  PermissionResponseDto,
  RoleDetailResponseDto,
  UpdateRoleDto,
} from './dto/role.dto';
import { RoleService } from './role.service';

const roleExample = {
  id: 6,
  name: 'role_manager',
  label: { ar: 'إدارة الأدوار', en: 'Role Management' },
  createdAt: '2026-07-31T12:00:00.000Z',
  permissions: [
    { id: 1, name: 'read:roles' },
    { id: 2, name: 'create:roles' },
  ],
  employees: [{ userId: 7, firstName: 'Ahmad', lastName: 'Saleh' }],
};

const permissionExample = {
  id: 1,
  name: 'read:roles',
};

@ApiTags('Roles')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for response error/success messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@ApiBearerAuth('jwt')
@Controller('roles')
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @CheckAbilities({ action: 'read', subject: 'Role' })
  @ApiOperation({ summary: 'List roles for authorized staff' })
  @ApiOkResponse({
    description: 'Roles fetched successfully',
    example: {
      success: true,
      message: 'Roles fetched successfully.',
      data: [
        {
          id: 6,
          name: 'role_manager',
          label: 'Role Management',
          createdAt: '2026-07-31T12:00:00.000Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:roles permission are required',
  })
  async findAll(@I18nLang() lang = 'ar') {
    const roles = await this.roleService.findAll(lang);
    return {
      success: true,
      message: this.i18n.t('role.FETCH_SUCCESS', { lang }),
      data: roles,
    };
  }

  @Get('permissions')
  @CheckAbilities({ action: 'read', subject: 'Role' })
  @ApiOperation({ summary: 'List all permissions for role management' })
  @ApiOkResponse({
    type: PermissionResponseDto,
    isArray: true,
    description: 'Permissions fetched successfully',
    example: {
      success: true,
      message: 'Permissions fetched successfully.',
      data: [permissionExample],
    },
  })
  // the first word is fear of the
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:roles permission are required',
  })
  async findAllPermissions(@I18nLang() lang = 'ar') {
    const permissions = await this.roleService.findAllPermissions();
    return {
      success: true,
      message: this.i18n.t('role.PERMISSIONS_FETCH_SUCCESS', { lang }),
      data: permissions,
    };
  }

  @Get(':id')
  @PreserveLabelResponse()
  @CheckAbilities({ action: 'read', subject: 'Role' })
  @ApiOperation({ summary: 'Get role details for authorized staff' })
  @ApiParam({ name: 'id', type: Number, example: 6 })
  @ApiOkResponse({
    type: RoleDetailResponseDto,
    description: 'Role fetched successfully',
    example: {
      success: true,
      message: 'Role fetched successfully.',
      data: roleExample,
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid role ID' })
  @ApiNotFoundResponse({ description: 'Role was not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:roles permission are required',
  })
  async findOne(@Param('id') id: string, @I18nLang() lang = 'ar') {
    const role = await this.roleService.findOne(id, lang);
    return {
      success: true,
      message: this.i18n.t('role.FETCH_ONE_SUCCESS', { lang }),
      data: role,
    };
  }

  @Post()
  @PreserveLabelResponse()
  @CheckAbilities({ action: 'create', subject: 'Role' })
  @ApiOperation({ summary: 'Create a role for authorized staff' })
  @ApiBody({ type: CreateRoleDto })
  @ApiCreatedResponse({
    description: 'Role created successfully',
    example: {
      success: true,
      message: 'Role created successfully.',
      data: roleExample,
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid role payload or missing permissions',
  })
  @ApiConflictResponse({ description: 'Role name already exists' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and create:roles permission are required',
  })
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @I18nLang() lang = 'ar',
  ) {
    const role = await this.roleService.create(createRoleDto, lang);
    return {
      success: true,
      message: this.i18n.t('role.CREATE_SUCCESS', { lang }),
      data: role,
    };
  }

  @Patch(':id')
  @PreserveLabelResponse()
  @CheckAbilities({ action: 'update', subject: 'Role' })
  @ApiOperation({ summary: 'Update a role for authorized staff' })
  @ApiParam({ name: 'id', type: Number, example: 6 })
  @ApiBody({ type: UpdateRoleDto })
  @ApiOkResponse({
    description: 'Role updated successfully',
    example: {
      success: true,
      message: 'Role updated successfully.',
      data: roleExample,
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid role ID, payload, or missing permissions',
  })
  @ApiNotFoundResponse({ description: 'Role was not found' })
  @ApiConflictResponse({ description: 'Role name already exists' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and update:roles permission are required',
  })
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @I18nLang() lang = 'ar',
  ) {
    const role = await this.roleService.update(id, updateRoleDto, lang);
    return {
      success: true,
      message: this.i18n.t('role.UPDATE_SUCCESS', { lang }),
      data: role,
    };
  }

  @Delete(':id')
  @CheckAbilities({ action: 'delete', subject: 'Role' })
  @ApiOperation({ summary: 'Delete an unused role for authorized staff' })
  @ApiParam({ name: 'id', type: Number, example: 6 })
  @ApiOkResponse({
    description: 'Role deleted successfully',
    example: {
      success: true,
      message: 'Role deleted successfully.',
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid role ID' })
  @ApiNotFoundResponse({ description: 'Role was not found' })
  @ApiConflictResponse({
    description: 'Role is protected or assigned to employees',
    example: {
      message:
        'This role is assigned to employees. Reassign or remove it first.',
      assignedEmployeesCount: 2,
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and delete:roles permission are required',
  })
  remove(@Param('id') id: string, @I18nLang() lang = 'ar') {
    return this.roleService.remove(id, lang);
  }
}
