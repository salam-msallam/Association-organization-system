import {
  BadRequestException,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { createUploadStorage } from '../interceptors/upload-storage.util';
import { AnnualReportService } from './annual-report.service';
import { CreateAnnualReportResponseDto } from './dto/create-annual-report-response.dto';

interface AuthenticatedStaffRequest extends Request {
  user: { id: number };
}

interface AnnualReportFiles {
  reportImageAr?: Express.Multer.File[];
  reportImageEn?: Express.Multer.File[];
}

@ApiTags('Admin Annual Reports')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'accept-language',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/admin/sponsorships')
@UseGuards(JwtAuthGuard, StaffOnlyGuard, AbilitiesGuard)
export class AnnualReportController {
  constructor(private readonly annualReportService: AnnualReportService) {}

  @Post(':sponsorshipId/annual-reports')
  @CheckAbilities({ action: 'create', subject: 'AnnualReport' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'reportImageAr', maxCount: 1 },
        { name: 'reportImageEn', maxCount: 1 },
      ],
      {
        storage: createUploadStorage('./uploads/annual-reports'),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (request, file, callback) => {
          if (
            !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
          ) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG, and WEBP images are allowed.',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a due annual sponsorship report' })
  @ApiParam({
    name: 'sponsorshipId',
    type: Number,
    example: 5,
    description: 'Sponsorship record ID',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reportImageAr', 'reportImageEn'],
      properties: {
        reportImageAr: {
          type: 'string',
          format: 'binary',
          description: 'Annual report image containing Arabic information',
        },
        reportImageEn: {
          type: 'string',
          format: 'binary',
          description: 'Annual report image containing English information',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: CreateAnnualReportResponseDto })
  @ApiBadRequestResponse({
    description:
      'One or both localized images are missing or invalid, the sponsorship is not accepted, the orphan information is outdated, the first payment is missing, or the next annual report is not due.',
  })
  @ApiNotFoundResponse({
    description: 'The sponsorship or employee record was not found.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description:
      'Staff access and create:annual_reports permission are required.',
  })
  create(
    @Param('sponsorshipId', ParseIntPipe) sponsorshipId: number,
    @UploadedFiles() files: AnnualReportFiles | undefined,
    @Req() req: AuthenticatedStaffRequest,
    @I18nLang() lang = 'ar',
  ): Promise<CreateAnnualReportResponseDto> {
    return this.annualReportService.create(
      sponsorshipId,
      req.user.id,
      files,
      lang,
    );
  }
}
