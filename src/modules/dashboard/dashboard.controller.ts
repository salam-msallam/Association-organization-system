import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
@Controller('admin/dashboard')
@UseGuards(AuthGuard('jwt')) 
@ApiTags('Dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  
  @ApiBearerAuth('jwt')
  @Get('summary')
  async getDashboardStatistics() {
    return await this.dashboardService.getDashboardStats();
  }
}