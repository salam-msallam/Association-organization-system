import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StaffOnlyGuard } from 'src/guards/staff-only.guard';

@Controller('admin/dashboard')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for the response error/success messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },  
})
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard)
@ApiTags('Dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  
  @ApiBearerAuth('jwt')
  @Get('summary')
  async getDashboardStatistics() {
    return await this.dashboardService.getDashboardStats();
  }
}
