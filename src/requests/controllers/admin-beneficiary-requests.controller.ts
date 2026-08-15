import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
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
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang, I18nService } from 'nestjs-i18n';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CheckAbilities } from '../../decorators/abilities.decorator';
import { PreserveBilingualResponse } from '../../decorators/preserve-bilingual-response.decorator';
import { AbilitiesGuard } from '../../guards/abilities.guard';
import {
  AdminEducationRequestDto,
  AdminFoodRequestDto,
  AdminHealthRequestDto,
  AdminHousingRequestDto,
  AdminSmallProjectRequestDto,
} from '../dto/admin-create-request.dto';
import { RequestAidService } from '../requests.service';
import { HOUSING_SUBCATEGORY_REQUIRED_FIELDS } from '../subcategory-required-fields';
import {
  AdminRequestMediaUploadInterceptor,
  toMediaUrl,
  toMediaUrls,
} from './request-media-upload';
import {
  academicAchievementProperty,
  adminRequestBodySchema,
  bilingualTextProperty,
  typeAidProperty,
} from './request-swagger-schema';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

interface AdminRequestFiles {
  media?: Express.Multer.File[];
  donorImage?: Express.Multer.File[];
}

@ApiTags('Admin Beneficiary Aid Requests')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'accept-language',
  description: 'Language used for success, error, and validation messages.',
  required: false,
  schema: { type: 'string', enum: ['ar', 'en'], default: 'ar' },
})
@ApiConsumes('multipart/form-data')
@ApiParam({
  name: 'beneficiaryId',
  type: Number,
  description: 'Beneficiary profile ID (Beneficiary.id)',
  example: 5,
})
@ApiCreatedResponse({
  schema: {
    example: { message: 'Assistance request created successfully.' },
  },
})
@ApiBadRequestResponse({
  description:
    'Invalid payload, incomplete beneficiary profile, unaccepted beneficiary, or invalid category selection.',
})
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description:
    'create::aid-requests permission and an employee profile are required.',
})
@ApiNotFoundResponse({ description: 'The beneficiary was not found.' })
@Controller('api/admin/beneficiaries/:beneficiaryId/requests')
@PreserveBilingualResponse()
@UseGuards(JwtAuthGuard, AbilitiesGuard)
@UseInterceptors(AdminRequestMediaUploadInterceptor())
export class AdminBeneficiaryRequestsController {
  constructor(
    private readonly requestAidService: RequestAidService,
    private readonly i18n: I18nService,
  ) {}

  @Post('health')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbilities({ action: 'create', subject: 'RequestAid' })
  @ApiOperation({ summary: 'Create an accepted health request for a beneficiary' })
  @ApiBody({
    schema: adminRequestBodySchema({ typeAid: typeAidProperty }, ['typeAid']),
  })
  createHealth(
    @Param('beneficiaryId') beneficiaryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminHealthRequestDto,
    @UploadedFiles() files: AdminRequestFiles,
    @I18nLang() lang = 'ar',
  ) {
    const uploads = this.requireUploads(files, lang);
    const { categoryId, subCategoryId, typeAid, ...baseFields } = dto;

    return this.requestAidService.createEmployeeRequestAid(
      req.user.id,
      this.parseBeneficiaryId(beneficiaryId, lang),
      categoryId,
      subCategoryId ?? null,
      baseFields,
      { typeAid, mediaUrls: uploads.mediaUrls },
      'Health',
      uploads.donorImageUrl,
      undefined,
      lang,
    );
  }

  @Post('food')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbilities({ action: 'create', subject: 'RequestAid' })
  @ApiOperation({ summary: 'Create an accepted food request for a beneficiary' })
  @ApiBody({
    schema: adminRequestBodySchema(
      {
        typeAid: { ...typeAidProperty, example: 'FOOD_BASKET' },
        numberIndividuals: { type: 'integer', example: 5 },
      },
      ['typeAid', 'numberIndividuals'],
    ),
  })
  createFood(
    @Param('beneficiaryId') beneficiaryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminFoodRequestDto,
    @UploadedFiles() files: AdminRequestFiles,
    @I18nLang() lang = 'ar',
  ) {
    const uploads = this.requireUploads(files, lang);
    const {
      categoryId,
      subCategoryId,
      typeAid,
      numberIndividuals,
      ...baseFields
    } = dto;

    return this.requestAidService.createEmployeeRequestAid(
      req.user.id,
      this.parseBeneficiaryId(beneficiaryId, lang),
      categoryId,
      subCategoryId ?? null,
      baseFields,
      { typeAid, numberIndividuals, mediaUrls: uploads.mediaUrls },
      'Food',
      uploads.donorImageUrl,
      undefined,
      lang,
    );
  }

  @Post('education')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbilities({ action: 'create', subject: 'RequestAid' })
  @ApiOperation({
    summary: 'Create an accepted education request for a beneficiary',
  })
  @ApiBody({
    schema: adminRequestBodySchema(
      {
        academicAchievement: academicAchievementProperty,
        institutionName: bilingualTextProperty,
        year: { type: 'string', example: '2026' },
      },
      ['academicAchievement', 'institutionName', 'year'],
    ),
  })
  createEducation(
    @Param('beneficiaryId') beneficiaryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminEducationRequestDto,
    @UploadedFiles() files: AdminRequestFiles,
    @I18nLang() lang = 'ar',
  ) {
    const uploads = this.requireUploads(files, lang);
    const {
      categoryId,
      subCategoryId,
      academicAchievement,
      institutionName,
      year,
      ...baseFields
    } = dto;

    return this.requestAidService.createEmployeeRequestAid(
      req.user.id,
      this.parseBeneficiaryId(beneficiaryId, lang),
      categoryId,
      subCategoryId ?? null,
      baseFields,
      {
        academicAchievement,
        institutionName,
        year,
        mediaUrls: uploads.mediaUrls,
      },
      'Education',
      uploads.donorImageUrl,
      undefined,
      lang,
    );
  }

  @Post('housing')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbilities({ action: 'create', subject: 'RequestAid' })
  @ApiOperation({ summary: 'Create an accepted housing request for a beneficiary' })
  @ApiBody({
    schema: adminRequestBodySchema(
      {
        currentHousingSituation: bilingualTextProperty,
        currentRent: { type: 'number', example: 250 },
        currentPlaceOfResidence: bilingualTextProperty,
        reasonForLock: bilingualTextProperty,
        housingSpecifications: bilingualTextProperty,
      },
      ['subCategoryId'],
    ),
  })
  createHousing(
    @Param('beneficiaryId') beneficiaryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminHousingRequestDto,
    @UploadedFiles() files: AdminRequestFiles,
    @I18nLang() lang = 'ar',
  ) {
    const uploads = this.requireUploads(files, lang);
    const {
      categoryId,
      subCategoryId,
      currentHousingSituation,
      currentRent,
      currentPlaceOfResidence,
      reasonForLock,
      housingSpecifications,
      ...baseFields
    } = dto;

    return this.requestAidService.createEmployeeRequestAid(
      req.user.id,
      this.parseBeneficiaryId(beneficiaryId, lang),
      categoryId,
      subCategoryId,
      baseFields,
      {
        currentHousingSituation,
        currentRent,
        currentPlaceOfResidence,
        reasonForLock,
        housingSpecifications,
        mediaUrls: uploads.mediaUrls,
      },
      'Housing',
      uploads.donorImageUrl,
      HOUSING_SUBCATEGORY_REQUIRED_FIELDS,
      lang,
    );
  }

  @Post('small-projects')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbilities({ action: 'create', subject: 'RequestAid' })
  @ApiOperation({
    summary: 'Create an accepted small-project request for a beneficiary',
  })
  @ApiBody({
    schema: adminRequestBodySchema(
      {
        projectName: bilingualTextProperty,
        projectCategory: bilingualTextProperty,
        numberOfPeopleSupported: { type: 'integer', example: 3 },
      },
      ['projectName', 'projectCategory', 'numberOfPeopleSupported'],
    ),
  })
  createSmallProject(
    @Param('beneficiaryId') beneficiaryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminSmallProjectRequestDto,
    @UploadedFiles() files: AdminRequestFiles,
    @I18nLang() lang = 'ar',
  ) {
    const uploads = this.requireUploads(files, lang);
    const {
      categoryId,
      subCategoryId,
      projectName,
      projectCategory,
      numberOfPeopleSupported,
      ...baseFields
    } = dto;

    return this.requestAidService.createEmployeeRequestAid(
      req.user.id,
      this.parseBeneficiaryId(beneficiaryId, lang),
      categoryId,
      subCategoryId ?? null,
      baseFields,
      {
        projectName,
        projectCategory,
        numberOfPeopleSupported,
        mediaUrls: uploads.mediaUrls,
      },
      'Small Projects',
      uploads.donorImageUrl,
      undefined,
      lang,
    );
  }

  private requireUploads(files: AdminRequestFiles, lang: string) {
    const mediaUrls = toMediaUrls(files?.media);
    const donorImageUrl = toMediaUrl(files?.donorImage?.[0]);

    if (!mediaUrls?.length || !donorImageUrl) {
      throw new BadRequestException(
        this.i18n.t('help-requests.ADMIN_MEDIA_REQUIRED', { lang }),
      );
    }

    return { mediaUrls, donorImageUrl };
  }

  private parseBeneficiaryId(value: string, lang: string): number {
    const beneficiaryId = Number(value);

    if (!/^\d+$/.test(value) || !Number.isInteger(beneficiaryId) || beneficiaryId <= 0) {
      throw new BadRequestException(
        this.i18n.t('help-requests.INVALID_BENEFICIARY_ID', { lang }),
      );
    }

    return beneficiaryId;
  }
}
