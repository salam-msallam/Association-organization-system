import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StaffOnlyGuard } from 'src/guards/staff-only.guard';
import { DashboardService } from './dashboard.service';
import { HelpRequestStatsResponseDto } from './dto/help-request-stats-response.dto';

@ApiTags('Dashboard')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for response error messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@ApiBearerAuth('jwt')
@Controller('api/admin/help-requests')
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard)
export class HelpRequestStatsController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get assistance request statistics for the staff dashboard',
  })
  @ApiOkResponse({
    type: HelpRequestStatsResponseDto,
    description: 'Assistance request statistics',
    example: {
      pending_count: 114,
      accepted_count: 142,
      rejected_count: 28,
      cancelled_count: 10,
      urgent_cases: 50,
      avg_review_time_days: 4.2,
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Only admins and employees are allowed',
  })
  getStats(): Promise<HelpRequestStatsResponseDto> {
    return this.dashboardService.getHelpRequestStats();
  }
}
