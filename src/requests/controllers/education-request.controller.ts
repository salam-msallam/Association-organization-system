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
import { EducationRequestDto } from '../dto/education-request.dto';
import { RequestAidService } from '../requests.service';
import {
  RequestMediaUploadInterceptor,
  toMediaUrls,
} from './request-media-upload';
import {
  academicAchievementProperty,
  bilingualTextProperty,
  requestBodySchema,
} from './request-swagger-schema';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

@Controller('requests/education')
@UseGuards(JwtAuthGuard)
export class EducationRequestController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: requestBodySchema(
      {
        academicAchievement: academicAchievementProperty,
        institutionName: {
          ...bilingualTextProperty,
          example: '{"ar":"جامعة دمشق","en":"Damascus University"}',
        },
        year: { type: 'string', example: '2026' },
      },
      ['academicAchievement', 'institutionName', 'year'],
    ),
  })
  @UseInterceptors(RequestMediaUploadInterceptor())
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EducationRequestDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
     if (!files || files.length === 0) {
    throw new BadRequestException('media is required, at least one file must be uploaded');
  }
    const {
      categoryId,
      subCategoryId,
      academicAchievement,
      institutionName,
      year,
      ...baseFields
    } = dto;

    return this.requestAidService.createRequestAid(
      req.user.id,
      categoryId,
      subCategoryId ?? null,
      baseFields,
      {
        academicAchievement,
        institutionName,
        year,
        mediaUrls: toMediaUrls(files),
      },
      'Education',
    );
  }
}
