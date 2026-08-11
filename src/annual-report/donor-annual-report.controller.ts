import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnnualReportService } from './annual-report.service';
import { DonorAnnualReportsResponseDto } from './dto/donor-annual-reports-response.dto';

interface AuthenticatedDonorRequest extends Request {
  user: {
    id: number;
    type?: string;
    userType?: string;
  };
}

@ApiTags('Sponsorships')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'accept-language',
  description: 'Language used to select the Arabic or English report image.',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('sponsorships')
export class DonorAnnualReportController {
  constructor(private readonly annualReportService: AnnualReportService) {}

  @Get(':sponsorshipId/annual-reports')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get annual reports for a sponsorship owned by the donor',
    description:
      'Returns all reports without pagination. reportYear is calculated from the first payment and reportNumber, and imageUrl is localized using accept-language.',
  })
  @ApiParam({ name: 'sponsorshipId', type: Number, example: 7 })
  @ApiOkResponse({ type: DonorAnnualReportsResponseDto })
  @ApiForbiddenResponse({
    description:
      'The authenticated user is not a donor or the sponsorship has no first payment.',
  })
  @ApiNotFoundResponse({
    description: 'The sponsorship does not exist or is not owned by the donor.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token is missing or invalid.' })
  findMine(
    @Param('sponsorshipId', ParseIntPipe) sponsorshipId: number,
    @Req() req: AuthenticatedDonorRequest,
    @I18nLang() lang = 'ar',
  ): Promise<DonorAnnualReportsResponseDto> {
    return this.annualReportService.findForDonor(sponsorshipId, req.user, lang);
  }
}
