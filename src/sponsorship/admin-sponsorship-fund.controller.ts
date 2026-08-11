import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrphanEmergencyCoverageStatus } from '@prisma/client';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import {
  AdminSponsorshipFundCoveragesResponseDto,
  AdminSponsorshipFundSummaryResponseDto,
  AdminSponsorshipFundSupportsResponseDto,
} from './dto/admin-sponsorship-fund-response.dto';
import { SponsorshipFundService } from './sponsorship-fund.service';

@ApiTags('Admin Sponsorship Fund')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for messages.',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@ApiBearerAuth('jwt')
@Controller('api/admin/sponsorship-fund')
@UseGuards(JwtAuthGuard, StaffOnlyGuard, AbilitiesGuard)
export class AdminSponsorshipFundController {
  constructor(
    private readonly sponsorshipFundService: SponsorshipFundService,
  ) {}

  @Get('summary')
  @CheckAbilities({ action: 'read', subject: 'SponsorshipFund' })
  @ApiOperation({ summary: 'Get sponsorship continuity fund dashboard summary' })
  @ApiOkResponse({ type: AdminSponsorshipFundSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description:
      'Staff access and read:sponsorship_fund permission are required.',
  })
  getSummary(
    @I18nLang() lang = 'ar',
  ): Promise<AdminSponsorshipFundSummaryResponseDto> {
    return this.sponsorshipFundService.getAdminSummary(lang);
  }

  @Get('coverages')
  @CheckAbilities({ action: 'read', subject: 'SponsorshipFund' })
  @ApiOperation({ summary: 'List sponsorship fund emergency coverages' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrphanEmergencyCoverageStatus,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({ type: AdminSponsorshipFundCoveragesResponseDto })
  @ApiBadRequestResponse({
    description: 'The status filter or pagination values are invalid.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description:
      'Staff access and read:sponsorship_fund permission are required.',
  })
  getCoverages(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @I18nLang() lang = 'ar',
  ): Promise<AdminSponsorshipFundCoveragesResponseDto> {
    return this.sponsorshipFundService.findAdminCoverages(
      status,
      page,
      limit,
      lang,
    );
  }

  @Get('supports')
  @CheckAbilities({ action: 'read', subject: 'SponsorshipFund' })
  @ApiOperation({ summary: 'List sponsorship fund support payments' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({ type: AdminSponsorshipFundSupportsResponseDto })
  @ApiBadRequestResponse({
    description: 'The pagination values are invalid.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description:
      'Staff access and read:sponsorship_fund permission are required.',
  })
  getSupports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @I18nLang() lang = 'ar',
  ): Promise<AdminSponsorshipFundSupportsResponseDto> {
    return this.sponsorshipFundService.findAdminSupports(page, limit, lang);
  }
}
