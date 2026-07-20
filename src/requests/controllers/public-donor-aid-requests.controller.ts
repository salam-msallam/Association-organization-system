import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import {
  PublicAidRequestDetailDto,
  PublicAidRequestListItemDto,
} from '../dto/public-aid-request-response.dto';
import { RequestAidService } from '../requests.service';

@ApiTags('Public Donor Aid Requests')
@ApiHeader({
  name: 'accept-language',
  description: 'Language used for localized title and description',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('donor/public/aid-requests')
export class PublicDonorAidRequestsController {
  constructor(private readonly requestAidService: RequestAidService) {}

  @Get()
  @ApiOperation({
    summary: 'List approved aid requests for public donor browsing',
  })
  @ApiQuery({ name: 'categoryId', required: false, type: Number, example: 1 })
  @ApiOkResponse({ type: PublicAidRequestListItemDto, isArray: true })
  @ApiBadRequestResponse({
    description: 'categoryId must be a positive integer',
  })
  findAll(
    @Query('categoryId') categoryId?: string,
    @I18nLang() lang = 'ar',
  ): Promise<PublicAidRequestListItemDto[]> {
    return this.requestAidService.getPublicAidRequests(
      this.parseOptionalPositiveInteger(categoryId),
      lang,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one approved aid request for public donor browsing',
  })
  @ApiParam({ name: 'id', type: Number, example: 13 })
  @ApiOkResponse({ type: PublicAidRequestDetailDto })
  @ApiBadRequestResponse({ description: 'The aid request ID is invalid' })
  @ApiNotFoundResponse({
    description: 'The aid request was not found or is not approved',
  })
  findOne(
    @Param('id') id: string,
    @I18nLang() lang = 'ar',
  ): Promise<PublicAidRequestDetailDto> {
    return this.requestAidService.getPublicAidRequestById(id, lang);
  }

  private parseOptionalPositiveInteger(
    value: string | undefined,
  ): number | undefined {
    if (value === undefined || value === '') return undefined;

    const normalizedValue = value.trim();
    const parsed = Number(normalizedValue);

    if (
      !/^\d+$/.test(normalizedValue) ||
      !Number.isSafeInteger(parsed) ||
      parsed <= 0
    ) {
      throw new BadRequestException('categoryId must be a positive integer');
    }

    return parsed;
  }
}
