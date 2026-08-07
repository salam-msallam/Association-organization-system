import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DonorService } from './donor.service';
import { MobileDonorHistoryResponseDto } from './dto/donor-response.dto';

interface AuthenticatedDonorRequest extends Request {
  user: {
    id: number;
    type?: string;
    userType?: string;
  };
}

@ApiTags('Donors')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for response messages and bilingual data',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/donors/me')
export class DonorMobileController {
  constructor(private readonly donorService: DonorService) {}

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Get current-year and previous-year financial history for the authenticated donor',
  })
  @ApiOkResponse({ type: MobileDonorHistoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'The authenticated user is not a donor',
  })
  getMyHistory(
    @Req() req: AuthenticatedDonorRequest,
    @I18nLang() lang = 'ar',
  ): Promise<MobileDonorHistoryResponseDto> {
    return this.donorService.getMyHistory(req.user, lang);
  }
}
