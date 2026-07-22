import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateRequestAidDto } from '../dto/update-request-aid.dto';
import { RequestAidService } from '../requests.service';
import {
  RequestMediaUploadInterceptor,
  toMediaUrls,
} from './request-media-upload';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

@ApiTags('Requests')
@ApiExtraModels(UpdateRequestAidDto)
@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Get('my-requests')
  @ApiBearerAuth('jwt')
  getMyRequests(@Req() req: AuthenticatedRequest) {
    return this.requestAidService.getMyRequests(req.user.id);
  }

  @Delete('cancel/:id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'إلغاء طلب الإعانة من قبل المستفيد (بس لو PENDING)',
  })
  cancelRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requestAidService.cancelRequestAid(req.user.id, id);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'تعديل طلب الإعانة من قبل المستفيد (فقط إذا كان PENDING)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(UpdateRequestAidDto) },
        {
          type: 'object',
          properties: {
            media: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
            },
          },
        },
      ],
    },
  })
  @UseInterceptors(RequestMediaUploadInterceptor())
  updateRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestAidDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const {
      academicAchievement,
      institutionName,
      year,
      typeAid,
      numberIndividuals,
      projectName,
      projectCategory,
      numberOfPeopleSupported,
      currentHousingSituation,
      currentRent,
      currentPlaceOfResidence,
      reasonForLock,
      housingSpecifications,
      ...baseFields
    } = dto;

    return this.requestAidService.updateRequestAid(
      req.user.id,
      id,
      baseFields,
      {
        academicAchievement,
        institutionName,
        year,
        typeAid,
        numberIndividuals,
        projectName,
        projectCategory,
        numberOfPeopleSupported,
        currentHousingSituation,
        currentRent,
        currentPlaceOfResidence,
        reasonForLock,
        housingSpecifications,
      },
      toMediaUrls(files),
    );
  }
}