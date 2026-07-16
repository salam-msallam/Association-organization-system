import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CheckAbilities } from '../../decorators/abilities.decorator';
import { AbilitiesGuard } from '../../guards/abilities.guard';
import { StaffOnlyGuard } from '../../guards/staff-only.guard';
import { AdminHelpRequestDetailResponseDto } from '../dto/admin-help-request-detail-response.dto';
import { AdminHelpRequestListResponseDto } from '../dto/admin-help-request-list-response.dto';
import { ReviewHelpRequestDto } from '../dto/review-help-request.dto';
import { ReviewHelpRequestResponseDto } from '../dto/review-help-request-response.dto';
import { RequestAidService } from '../requests.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

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

  @Patch(':id/status')
  @CheckAbilities({ action: 'status', subject: 'RequestAid' })
  @ApiOperation({
    summary: 'Accept or reject an assistance request for authorized staff',
  })
  @ApiParam({ name: 'id', type: Number, example: 13 })
  @ApiBody({ type: ReviewHelpRequestDto })
  @ApiOkResponse({ type: ReviewHelpRequestResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid request ID, status, or review payload',
  })
  @ApiNotFoundResponse({ description: 'The assistance request was not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and status:aid_requests permission are required',
  })
  reviewStatus(
    @Param('id') id: string,
    @Body() dto: ReviewHelpRequestDto,
    @Req() req: AuthenticatedRequest,
    @I18nLang() lang = 'ar',
  ): Promise<ReviewHelpRequestResponseDto> {
    return this.requestAidService.reviewHelpRequestStatus(
      id,
      req.user.id,
      dto,
      lang,
    );
  }

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
  ): number {
    const parsed = value ? parseInt(value, 10) : defaultValue;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  }
}
