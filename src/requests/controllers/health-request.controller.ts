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
import { HealthRequestDto } from '../dto/health-request.dto';
import {
  RequestMediaUploadInterceptor,
  toMediaUrls,
} from './request-media-upload';
import { requestBodySchema, typeAidProperty } from './request-swagger-schema';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

@Controller('requests/health')
@UseGuards(JwtAuthGuard)
export class HealthRequestController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: requestBodySchema({ typeAid: typeAidProperty }, ['typeAid']),
  })
  @UseInterceptors(RequestMediaUploadInterceptor())
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: HealthRequestDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
      if (!files || files.length === 0) {
    throw new BadRequestException('media is required, at least one file must be uploaded');
  }
    const { categoryId, subCategoryId, typeAid, ...baseFields } = dto;

    return this.requestAidService.createRequestAid(
      req.user.id,
      categoryId,
      subCategoryId ?? null,
      baseFields,
      { typeAid, mediaUrls: toMediaUrls(files) },
      'Health',
    );
  }
}
