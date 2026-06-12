import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
@ApiTags('Dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiBearerAuth()
  @Get('summary')
    @ApiOperation({ summary: 'Register a new donor account' })
    @ApiResponse({ status: 201, description: 'OTP was sent to the donor phone number.' })
    @ApiResponse({ status: 400, description: 'Invalid request body.' })
  async getDashboardStatistics() {
    return await this.dashboardService.getDashboardStats();
  }
}