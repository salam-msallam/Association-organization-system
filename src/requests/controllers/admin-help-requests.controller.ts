import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CheckAbilities } from '../../decorators/abilities.decorator';
import { AbilitiesGuard } from '../../guards/abilities.guard';
import { StaffOnlyGuard } from '../../guards/staff-only.guard';
import { AdminHelpRequestDetailResponseDto } from '../dto/admin-help-request-detail-response.dto';
import { AdminHelpRequestListResponseDto } from '../dto/admin-help-request-list-response.dto';
import { RequestAidService } from '../requests.service';

@ApiTags('Admin Help Requests')
@ApiHeader({
  name: 'accept-language',
  description:
    'Language used for messages, errors, and list fallback category names; detail JSON fields remain bilingual',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@ApiBearerAuth('jwt')
@Controller('api/admin/help-requests')
@UseGuards(JwtAuthGuard, StaffOnlyGuard, AbilitiesGuard)
export class AdminHelpRequestsController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Get()
  @CheckAbilities({ action: 'read', subject: 'RequestAid' })
  @ApiOperation({ summary: 'List assistance requests for authorized staff' })
  @ApiQuery({ name: 'status', required: false, enum: Status })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiOkResponse({ type: AdminHelpRequestListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:aid_requests permission are required',
  })
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @I18nLang() lang = 'ar',
  ): Promise<AdminHelpRequestListResponseDto> {
    return this.requestAidService.getAdminHelpRequests(
      status,
      this.parsePositiveInteger(page, 1),
      this.parsePositiveInteger(limit, 10),
      lang,
    );
  }

  @Get(':id')
  @CheckAbilities({ action: 'read', subject: 'RequestAid' })
  @ApiOperation({
    summary: 'Get assistance request details for authorized staff',
  })
  @ApiParam({ name: 'id', type: Number, example: 13 })
  @ApiOkResponse({ type: AdminHelpRequestDetailResponseDto })
  @ApiBadRequestResponse({
    description: 'The assistance request ID is invalid',
  })
  @ApiNotFoundResponse({ description: 'The assistance request was not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:aid_requests permission are required',
  })
  findOne(
    @Param('id') id: string,
    @I18nLang() lang = 'ar',
  ): Promise<AdminHelpRequestDetailResponseDto> {
    return this.requestAidService.getAdminHelpRequestById(id, lang);
  }

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
  ): number {
    const parsed = value ? parseInt(value, 10) : defaultValue;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  }
}
