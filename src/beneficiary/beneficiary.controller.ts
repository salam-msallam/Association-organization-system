import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseInterceptors,
  UseGuards,
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
import { AuthGuard } from '@nestjs/passport';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { Status } from '@prisma/client';
import { I18nLang } from 'nestjs-i18n';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { PreserveBilingualResponse } from '../decorators/preserve-bilingual-response.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { BeneficiaryService } from './beneficiary.service';
import { ReviewBeneficiaryDto } from './dto/review-beneficiary.dto';
import { ReviewBeneficiaryResponseDto } from './dto/review-beneficiary-response.dto';

@ApiTags('Admin Beneficiaries')
@ApiHeader({
  name: 'accept-language',
  description:
    'Language preferred for response messages and errors; bilingual JSON data always includes ar and en',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/admin/beneficiaries')
@PreserveBilingualResponse()
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
export class AdminBeneficiariesController {
  constructor(private readonly beneficiaryService: BeneficiaryService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Beneficiary' })
  @ApiOperation({ summary: 'List beneficiary accounts for employees' })
  @ApiQuery({ name: 'status', required: false, enum: Status })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @I18nLang() lang = 'ar',
  ) {
    return this.beneficiaryService.findAll(
      status,
      this.parsePositiveInteger(page, 1),
      this.parsePositiveInteger(limit, 10),
      lang,
    );
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Beneficiary' })
  @ApiOperation({
    summary: 'Get full beneficiary account details for employee',
  })
  findOne(@Param('id') id: string, @I18nLang() lang = 'ar') {
    return this.beneficiaryService.findOne(+id, lang);
  }

  @Patch(':id/status')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'status', subject: 'Beneficiary' })
  @ApiOperation({
    summary: 'Accept or reject a pending beneficiary account',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 12,
    description: 'Beneficiary user account ID',
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
          description: 'Beneficiary account review decision',
        },
        rejectionReason: {
          type: 'object',
          description: 'Required only when status is REJECTED',
          example: {
            ar: 'الوثائق غير مكتملة',
            en: 'The documents are incomplete',
          },
        },
      },
      required: ['status'],
    },
  })
  @UseInterceptors(NoFilesInterceptor())
  @ApiOkResponse({ type: ReviewBeneficiaryResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid account ID, review status, payload, or an already reviewed account',
  })
  @ApiNotFoundResponse({
    description: 'The beneficiary account was not found',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description:
      'Staff access and status:beneficiaries permission are required',
  })
  reviewStatus(
    @Param('id') id: string,
    @Body() dto: ReviewBeneficiaryDto,
    @I18nLang() lang = 'ar',
  ): Promise<ReviewBeneficiaryResponseDto> {
    return this.beneficiaryService.reviewStatus(+id, dto, lang);
  }

  private parsePositiveInteger(
    value: string | undefined,
    defaultValue: number,
  ): number {
    const parsed = value ? parseInt(value, 10) : defaultValue;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  }
}
