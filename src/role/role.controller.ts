import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { AbilitiesGuard} from '../guards/abilities.guard';
import { CheckAbilities } from '../decorators/abilities.decorator'; 
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { AuthGuard } from '@nestjs/passport'; 
import { ApiBearerAuth} from '@nestjs/swagger'; 
import { I18nLang, I18nService } from 'nestjs-i18n';

@Controller('role')
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard) 
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Role' })
  async findAll(@I18nLang() lang: string) {
    const roles = await this.roleService.findAll();
    return {
      success: true,
      message: this.i18n.t('role.FETCH_SUCCESS', { lang }),
      data: roles,
    };
  }
}
