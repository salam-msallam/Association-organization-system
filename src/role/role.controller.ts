import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { AbilitiesGuard} from '../guards/abilities.guard';
import { CheckAbilities } from '../decorators/abilities.decorator'; 
import { AuthGuard } from '@nestjs/passport'; 
import { ApiBearerAuth} from '@nestjs/swagger'; 

@Controller('role')
@UseGuards(AuthGuard('jwt'), AbilitiesGuard) 
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Role' })
  async findAll() {
    const roles = await this.roleService.findAll();
    return {
      success: true,
      message: 'تم جلب قائمة الأدوار بنجاح',
      data: roles,
    };
  }
}