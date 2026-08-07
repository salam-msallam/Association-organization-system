import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StaffOnlyGuard } from 'src/guards/staff-only.guard';
import { DashboardService } from './dashboard.service';
import {
  AidRequestCategoryDistributionItemDto,
  AnnualDonationDistributionItemDto,
  MonthlyDonationDistributionItemDto,
  OrphanStatisticsResponseDto,
  SponsorshipStatisticsResponseDto,
} from './dto/admin-dashboard-statistics-response.dto';

type DonationDistributionPeriod = 'annual' | 'monthly';

@ApiTags('Admin Dashboard Statistics')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for response error messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@ApiBearerAuth('jwt')
@ApiExtraModels(
  AnnualDonationDistributionItemDto,
  MonthlyDonationDistributionItemDto,
)
@Controller('api/admin/dashboard')
@UseGuards(JwtAuthGuard, StaffOnlyGuard)
export class AdminDashboardStatisticsController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('charts/distributions')
  @ApiOperation({
    summary: 'Get annual or monthly donation distribution for the dashboard',
  })
  @ApiQuery({
    name: 'period',
    required: true,
    enum: ['annual', 'monthly'],
    example: 'annual',
  })
  @ApiOkResponse({
    description: 'Donation distribution in USD',
    schema: {
      oneOf: [
        {
          type: 'array',
          items: { $ref: '#/components/schemas/AnnualDonationDistributionItemDto' },
        },
        {
          type: 'array',
          items: { $ref: '#/components/schemas/MonthlyDonationDistributionItemDto' },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: 'period must be annual or monthly',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Only admins and employees are allowed',
  })
  getDonationDistribution(
    @Query('period') period?: string,
  ): Promise<
    AnnualDonationDistributionItemDto[] | MonthlyDonationDistributionItemDto[]
  > {
    return this.dashboardService.getDonationDistribution(
      this.parseDonationDistributionPeriod(period),
    );
  }

  @Get('charts/requests')
  @ApiOperation({
    summary: 'Get aid request distribution by category for the dashboard',
  })
  @ApiOkResponse({
    type: AidRequestCategoryDistributionItemDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Only admins and employees are allowed',
  })
  getAidRequestCategoryDistribution(): Promise<
    AidRequestCategoryDistributionItemDto[]
  > {
    return this.dashboardService.getAidRequestCategoryDistribution();
  }

  @Get('sponsorships')
  @ApiOperation({
    summary: 'Get sponsorship request counts by status for the dashboard',
  })
  @ApiOkResponse({ type: SponsorshipStatisticsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Only admins and employees are allowed',
  })
  getSponsorshipStatistics(): Promise<SponsorshipStatisticsResponseDto> {
    return this.dashboardService.getSponsorshipStatistics();
  }

  @Get('orphans')
  @ApiOperation({
    summary: 'Get orphan sponsorship state counts for the dashboard',
  })
  @ApiOkResponse({ type: OrphanStatisticsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Only admins and employees are allowed',
  })
  getOrphanStatistics(): Promise<OrphanStatisticsResponseDto> {
    return this.dashboardService.getOrphanStatistics();
  }

  private parseDonationDistributionPeriod(
    period: string | undefined,
  ): DonationDistributionPeriod {
    if (period === 'annual' || period === 'monthly') {
      return period;
    }

    throw new BadRequestException('period must be annual or monthly');
  }
}
