import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { AuthGuard } from '@nestjs/passport';
import {
  FileFieldsInterceptor,
  NoFilesInterceptor,
} from '@nestjs/platform-express';
import { Status } from '@prisma/client';
import { I18nLang, I18nService } from 'nestjs-i18n';
import { AuthService } from '../auth/auth.service';
import { RegisterBeneficiaryDto } from '../auth/dto/register-beneficiary.dto';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { PreserveBilingualResponse } from '../decorators/preserve-bilingual-response.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import {
  createUploadStorage,
  toPublicUploadPath,
} from '../interceptors/upload-storage.util';
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
  constructor(
    private readonly beneficiaryService: BeneficiaryService,
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'create', subject: 'Beneficiary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegisterBeneficiaryDto })
  @ApiOperation({
    summary: 'Create an accepted beneficiary account from the dashboard',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'personalPhoto', maxCount: 1 },
        { name: 'familyStatement', maxCount: 1 },
      ],
      { storage: createUploadStorage('./uploads/beneficiaries') },
    ),
  )
  @ApiCreatedResponse({
    description: 'The accepted beneficiary account was created successfully.',
    schema: {
      example: {
        success: true,
        message: 'Registration completed successfully.',
        userId: 12,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid registration data, missing files, or duplicate email or phone number.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({
    description:
      'Staff access and create::beneficiaries permission are required.',
  })
  async create(
    @Body() dto: RegisterBeneficiaryDto,
    @UploadedFiles()
    files: {
      personalPhoto?: Array<{ path: string }>;
      familyStatement?: Array<{ path: string }>;
    },
    @I18nLang() lang = 'ar',
  ) {
    const personalPhoto = files?.personalPhoto?.[0]?.path;
    const familyStatement = files?.familyStatement?.[0]?.path;

    if (!personalPhoto || !familyStatement) {
      throw new BadRequestException(
        this.i18n.t('auth.BENEFICIARY_FILES_REQUIRED', { lang }),
      );
    }

    dto.personalPhoto = toPublicUploadPath(personalPhoto);
    dto.familyStatement = toPublicUploadPath(familyStatement);

    return this.authService.createDashboardBeneficiary(dto, lang);
  }

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
