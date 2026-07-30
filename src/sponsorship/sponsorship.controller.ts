import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Status } from '@prisma/client';
import type { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSponsorshipResponseDto } from './dto/create-sponsorship-response.dto';
import { SponsorshipListResponseDto } from './dto/sponsorship-list-response.dto';
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
}
