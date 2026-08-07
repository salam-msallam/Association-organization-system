import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CheckAbilities } from 'src/decorators/abilities.decorator';
import { AbilitiesGuard } from 'src/guards/abilities.guard';
import { StaffOnlyGuard } from 'src/guards/staff-only.guard';
import { DashboardUsersCountResponseDto } from './dto/dashboard-users-count-response.dto';

@Controller('admin/dashboard')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for the response error/success messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },  
})
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
@ApiTags('Dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  
  @ApiBearerAuth('jwt')
  @Get('summary')
  async getDashboardStatistics() {
    return await this.dashboardService.getDashboardStats();
  }

  @ApiBearerAuth('jwt')
  @Get('users-count')
  @CheckAbilities({ action: 'read', subject: 'Employee' })
  @ApiOperation({
    summary: 'Get donor and beneficiary totals for the admin dashboard',
  })
  @ApiOkResponse({
    type: DashboardUsersCountResponseDto,
    description: 'Donor and beneficiary totals',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:employees permission are required',
  })
  async getUsersCount(): Promise<DashboardUsersCountResponseDto> {
    return this.dashboardService.getUsersCount();
  }
}
