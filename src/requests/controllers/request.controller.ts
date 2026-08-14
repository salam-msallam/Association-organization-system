import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Body,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateRequestAidDto } from '../dto/update-request-aid.dto';
import { BeneficiaryAidRequestDetailResponseDto } from '../dto/beneficiary-aid-request-detail-response.dto';
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
@ApiHeader({
  name: 'accept-language',
  description: 'Language used for translated fields and errors',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Get('my-requests')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Get assistance requests for the authenticated beneficiary',
    description:
      'Returns all requests owned by the beneficiary, optionally filtered by status.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: Status,
    description:
      'Optional filter: PENDING, ACCEPTED, REJECTED, or CANCELLED. Omit it to return all statuses.',
  })
  @ApiOkResponse({ description: 'Assistance requests fetched successfully.' })
  @ApiBadRequestResponse({ description: 'The status filter is invalid.' })
  @ApiForbiddenResponse({
    description: 'The authenticated account is not a beneficiary.',
  })
  getMyRequests(
    @Req() req: AuthenticatedRequest,
    @Query('status') status: string | undefined,
    @I18nLang() lang = 'ar',
  ) {
    return this.requestAidService.getMyRequests(req.user.id, status, lang);
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Get one assistance request owned by the authenticated beneficiary',
    description:
      'Returns the full request only when it belongs to the authenticated beneficiary.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 13,
    description: 'Assistance request ID',
  })
  @ApiOkResponse({
    description: 'Assistance request fetched successfully.',
    type: BeneficiaryAidRequestDetailResponseDto,
  })
  @ApiBadRequestResponse({ description: 'The request ID is invalid.' })
  @ApiForbiddenResponse({
    description: 'The authenticated account is not a beneficiary.',
  })
  @ApiNotFoundResponse({
    description:
      'The request does not exist or does not belong to the authenticated beneficiary.',
  })
  getMyRequestById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @I18nLang() lang = 'ar',
  ) {
    return this.requestAidService.getMyRequestById(req.user.id, id, lang);
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
    summary: 'تعديل طلب الإعانة من قبل المستفيد ',
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
