import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { NoFilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import {
  AdminSponsorshipDetailResponseDto,
  AdminSponsorshipListResponseDto,
  ReviewSponsorshipResponseDto,
} from './dto/admin-sponsorship-response.dto';
import { ReviewSponsorshipDto } from './dto/review-sponsorship.dto';
import { SponsorshipService } from './sponsorship.service';

interface AuthenticatedStaffRequest extends Request {
  user: { id: number };
}

@ApiTags('Admin Sponsorships')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for messages and translated JSON fields.',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@ApiBearerAuth('jwt')
@Controller('api/admin/sponsorships')
@UseGuards(JwtAuthGuard, StaffOnlyGuard, AbilitiesGuard)
export class AdminSponsorshipController {
  constructor(private readonly sponsorshipService: SponsorshipService) {}

  @Get()
  @CheckAbilities({ action: 'read', subject: 'Sponsorship' })
  @ApiOperation({ summary: 'List sponsorship requests for authorized staff' })
  @ApiQuery({ name: 'status', required: false, enum: Status })
  @ApiOkResponse({ type: AdminSponsorshipListResponseDto })
  @ApiBadRequestResponse({ description: 'The status filter is invalid.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:sponsorships permission are required.',
  })
  findAll(
    @Query('status') status?: string,
    @I18nLang() lang = 'ar',
  ): Promise<AdminSponsorshipListResponseDto> {
    return this.sponsorshipService.findAllForStaff(status, lang);
  }

  @Get(':id')
  @CheckAbilities({ action: 'read', subject: 'Sponsorship' })
  @ApiOperation({ summary: 'Get one sponsorship request by ID for staff' })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 5,
    description: 'Sponsorship request ID',
  })
  @ApiOkResponse({ type: AdminSponsorshipDetailResponseDto })
  @ApiNotFoundResponse({ description: 'The sponsorship was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:sponsorships permission are required.',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @I18nLang() lang = 'ar',
  ): Promise<AdminSponsorshipDetailResponseDto> {
    return this.sponsorshipService.findOneForStaff(id, lang);
  }

  @Patch(':id/status')
  @CheckAbilities({ action: 'status', subject: 'Sponsorship' })
  @ApiOperation({
    summary: 'Accept or reject a pending sponsorship request',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 5,
    description: 'Sponsorship request ID',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: [Status.ACCEPTED, Status.REJECTED],
          example: Status.ACCEPTED,
          description: 'Sponsorship request review decision',
        },
        orphanId: {
          type: 'integer',
          example: 3,
          description: 'Required only when status is ACCEPTED',
        },
        rejectionReason: {
          type: 'object',
          description: 'Required only when status is REJECTED',
          example: {
            ar: 'لا يوجد يتيم مناسب حالياً',
            en: 'No suitable orphan is currently available',
          },
        },
      },
      required: ['status'],
    },
  })
  @UseInterceptors(NoFilesInterceptor())
  @ApiOkResponse({ type: ReviewSponsorshipResponseDto })
  @ApiBadRequestResponse({
    description:
      'The request is no longer pending, the payload is invalid, or the orphan is already sponsored.',
  })
  @ApiNotFoundResponse({ description: 'The sponsorship was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description:
      'Staff access and status:sponsorships permission are required.',
  })
  reviewStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewSponsorshipDto,
    @Req() req: AuthenticatedStaffRequest,
    @I18nLang() lang = 'ar',
  ): Promise<ReviewSponsorshipResponseDto> {
    return this.sponsorshipService.reviewStatus(id, req.user.id, dto, lang);
  }
}
