import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { HousingRequestDto } from '../dto/housing-request.dto';
import { RequestAidService } from '../requests.service';
import {
  RequestMediaUploadInterceptor,
  toMediaUrls,
} from './request-media-upload';
import {
  bilingualTextProperty,
  requestBodySchema,
} from './request-swagger-schema';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}


const HOUSING_SUBCATEGORY_REQUIRED_FIELDS: Record<number, string[]> = {
  1: ['currentPlaceOfResidence', 'housingSpecifications', 'reasonForLock'],
  2: ['currentRent'],
  3: ['currentHousingSituation'],
};

@Controller('requests/housing')
@UseGuards(JwtAuthGuard)
export class HousingRequestController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: requestBodySchema(
      {
        subCategoryId: { type: 'integer', example: 2 },
        currentHousingSituation: {
          ...bilingualTextProperty,
          description:
            'مطلوب فقط إذا كان subCategoryId = 3 (إصلاحات منزلية)',
          example:
            '{"ar":"استئجار شقة صغيرة","en":"Renting a small apartment"}',
        },
        currentRent: {
          type: 'number',
          description:
            'مطلوب فقط إذا كان subCategoryId = 2 (مساعدة في إيجار البيت)',
          example: 250,
        },
        currentPlaceOfResidence: {
          ...bilingualTextProperty,
          description: 'مطلوب فقط إذا كان subCategoryId = 1 (تأمين منزل)',
          example: '{"ar":"دمشق","en":"Damascus"}',
        },
        reasonForLock: {
          ...bilingualTextProperty,
          description: 'مطلوب فقط إذا كان subCategoryId = 1 (تأمين منزل)',
          example:
            '{"ar":"غير قادر على دفع الإيجار هذا الشهر","en":"Unable to pay rent this month"}',
        },
        housingSpecifications: {
          ...bilingualTextProperty,
          description: 'مطلوب فقط إذا كان subCategoryId = 1 (تأمين منزل)',
          example:
            '{"ar":"غرفتان وتحتاج إلى إصلاحات أساسية","en":"Two rooms, needs basic repairs"}',
        },
      },
     
      ['subCategoryId'],
    ),
  })
  @UseInterceptors(RequestMediaUploadInterceptor())
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: HousingRequestDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'media is required, at least one file must be uploaded',
      );
    }

    if (!dto.subCategoryId) {
      throw new BadRequestException(
        'subCategoryId is required for housing requests',
      );
    }

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

    return this.requestAidService.createRequestAid(
      req.user.id,
      categoryId,
      subCategoryId,
      baseFields,
      {
        currentHousingSituation,
        currentRent,
        currentPlaceOfResidence,
        reasonForLock,
        housingSpecifications,
        mediaUrls: toMediaUrls(files),
      },
      'Housing',
      HOUSING_SUBCATEGORY_REQUIRED_FIELDS,
    );
  }
}