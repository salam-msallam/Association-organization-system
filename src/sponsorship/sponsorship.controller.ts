import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
import type { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSponsorshipResponseDto } from './dto/create-sponsorship-response.dto';
import { CancelSponsorshipResponseDto } from './dto/cancel-sponsorship-response.dto';
import { SponsorshipListResponseDto } from './dto/sponsorship-list-response.dto';
import { OrphanSummaryResponseDto } from './dto/orphan-summary-response.dto';
import { SponsorshipService } from './sponsorship.service';

interface AuthenticatedSponsorshipRequest extends Request {
  user: {
    id: number;
    type?: string;
    userType?: string;
  };
}

@ApiTags('Sponsorships')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for translated sponsorship messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('sponsorships')
export class SponsorshipController {
  constructor(private readonly sponsorshipService: SponsorshipService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Create a general orphan sponsorship request for employee review',
    description:
      'The authenticated donor must have $30 available for every pending or accepted sponsorship, including the new request. No request body is required.',
  })
  @ApiCreatedResponse({ type: CreateSponsorshipResponseDto })
  @ApiBadRequestResponse({
    description:
      'The wallet does not cover three months for all pending and accepted sponsorships.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiForbiddenResponse({
    description: 'The authenticated user is not a donor.',
  })
  create(@Req() req: AuthenticatedSponsorshipRequest, @I18nLang() lang = 'ar') {
    return this.sponsorshipService.createRequest(req.user, lang);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Get all sponsorships for the authenticated donor',
    description:
      'Returns every sponsorship owned by the authenticated donor. Use the optional status query parameter to filter the results.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: Status,
    description:
      'Optional filter: PENDING, ACCEPTED, REJECTED, or CANCELLED. Omit it to return all statuses.',
  })
  @ApiOkResponse({ type: SponsorshipListResponseDto })
  @ApiBadRequestResponse({ description: 'The status filter is invalid.' })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiForbiddenResponse({
    description: 'The authenticated user is not a donor.',
  })
  findMine(
    @Req() req: AuthenticatedSponsorshipRequest,
    @Query('status') status: string | undefined,
    @I18nLang() lang = 'ar',
  ) {
    return this.sponsorshipService.findMine(req.user, status, lang);
  }

  @Get(':sponsorshipId/orphan-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Get the sponsored orphan summary after the first payment',
    description:
      'This is a separate endpoint and does not change the sponsorship list response. It returns a limited localized summary only to the donor who owns the accepted and paid sponsorship.',
  })
  @ApiParam({ name: 'sponsorshipId', type: Number, example: 7 })
  @ApiOkResponse({ type: OrphanSummaryResponseDto })
  @ApiForbiddenResponse({
    description:
      'The authenticated user is not a donor or the first sponsorship payment has not been made.',
  })
  @ApiNotFoundResponse({
    description:
      'The accepted sponsorship was not found, is not owned by the donor, or has no assigned orphan.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  findOrphanSummary(
    @Param('sponsorshipId', ParseIntPipe) sponsorshipId: number,
    @Req() req: AuthenticatedSponsorshipRequest,
    @I18nLang() lang = 'ar',
  ): Promise<OrphanSummaryResponseDto> {
    return this.sponsorshipService.findOrphanSummary(
      sponsorshipId,
      req.user,
      lang,
    );
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Cancel a pending or accepted sponsorship',
    description:
      'Cancels a sponsorship owned by the authenticated donor. An accepted sponsorship ends immediately and releases its orphan.',
  })
  @ApiParam({ name: 'id', type: Number, example: 4 })
  @ApiOkResponse({ type: CancelSponsorshipResponseDto })
  @ApiBadRequestResponse({
    description:
      'The sponsorship is already cancelled, rejected, or changed concurrently.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  @ApiForbiddenResponse({
    description: 'The authenticated user is not a donor.',
  })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedSponsorshipRequest,
    @I18nLang() lang = 'ar',
  ) {
    return this.sponsorshipService.cancel(id, req.user, lang);
  }
}
