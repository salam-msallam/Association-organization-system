import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { PreserveBilingualResponse } from '../decorators/preserve-bilingual-response.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { CreateQuickAidDisbursementDto } from './dto/create-quick-aid-disbursement.dto';
import {
  CreateQuickAidDisbursementResponseDto,
  QuickAidDisbursementListResponseDto,
  QuickAidFundSummaryResponseDto,
} from './dto/quick-aid-fund-response.dto';
import { QuickAidFundService } from './quick-aid-fund.service';

interface AuthenticatedQuickAidStaffRequest extends Request {
  user: { id: number };
}

@ApiTags('Admin Quick Aid Fund')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for messages; reason remains bilingual.',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/admin/quick-aid-fund')
@PreserveBilingualResponse()
@UseGuards(JwtAuthGuard, StaffOnlyGuard, AbilitiesGuard)
export class AdminQuickAidFundController {
  constructor(private readonly quickAidFundService: QuickAidFundService) {}

  @Get('summary')
  @CheckAbilities({ action: 'read', subject: 'QuickAidFund' })
  @ApiOperation({ summary: 'Get the quick aid fund summary' })
  @ApiOkResponse({ type: QuickAidFundSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:quick_aid_fund are required.',
  })
  getSummary(
    @I18nLang() lang = 'ar',
  ): Promise<QuickAidFundSummaryResponseDto> {
    return this.quickAidFundService.getSummary(lang);
  }

  @Post('disbursements')
  @CheckAbilities({ action: 'create', subject: 'QuickAidDisbursement' })
  @ApiOperation({ summary: 'Create an immediately accepted disbursement' })
  @ApiBody({ type: CreateQuickAidDisbursementDto })
  @ApiCreatedResponse({ type: CreateQuickAidDisbursementResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid data, unaccepted beneficiary, or insufficient balance.',
  })
  @ApiNotFoundResponse({ description: 'Beneficiary or employee was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description: 'An employee with create:quick_aid_disbursements is required.',
  })
  createDisbursement(
    @Body() dto: CreateQuickAidDisbursementDto,
    @Req() req: AuthenticatedQuickAidStaffRequest,
    @I18nLang() lang = 'ar',
  ): Promise<CreateQuickAidDisbursementResponseDto> {
    return this.quickAidFundService.createDisbursement(dto, req.user.id, lang);
  }

  @Get('list')
  @CheckAbilities({ action: 'read', subject: 'QuickAidFund' })
  @ApiOperation({ summary: 'List quick aid fund disbursements' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({ type: QuickAidDisbursementListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination values.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:quick_aid_fund are required.',
  })
  getList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @I18nLang() lang = 'ar',
  ): Promise<QuickAidDisbursementListResponseDto> {
    return this.quickAidFundService.findDisbursements(page, limit, lang);
  }
}
