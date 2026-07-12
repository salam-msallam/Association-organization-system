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
import { RequestAidService } from '../requests.service';
import { SmallProjectRequestDto } from '../dto/small-project-request.dto';
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

@Controller('requests/small-projects')
@UseGuards(JwtAuthGuard)
export class SmallProjectRequestController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: requestBodySchema(
      {
        projectName: {
          ...bilingualTextProperty,
          example: '{"ar":"مخبز منزلي","en":"Home bakery"}',
        },
        projectCategory: {
          ...bilingualTextProperty,
          example: '{"ar":"إنتاج غذائي","en":"Food production"}',
        },
        numberOfPeopleSupported: { type: 'integer', example: 3 },
      },
      ['projectName', 'projectCategory', 'numberOfPeopleSupported'],
    ),
  })
  @UseInterceptors(RequestMediaUploadInterceptor())
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SmallProjectRequestDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
     if (!files || files.length === 0) {
    throw new BadRequestException('media is required, at least one file must be uploaded');
  }
    const {
      categoryId,
      subCategoryId,
      projectName,
      projectCategory,
      numberOfPeopleSupported,
      ...baseFields
    } = dto;

    return this.requestAidService.createRequestAid(
      req.user.id,
      categoryId,
      subCategoryId ?? null,
      baseFields,
      {
        projectName,
        projectCategory,
        numberOfPeopleSupported,
        mediaUrls: toMediaUrls(files),
      },
      'Small Projects',
    );
  }
}
