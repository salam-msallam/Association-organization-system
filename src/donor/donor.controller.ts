import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { I18nLang } from 'nestjs-i18n';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { PreserveBilingualResponse } from '../decorators/preserve-bilingual-response.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { DonorService } from './donor.service';
import {
  AdminDonorHistoryResponseDto,
  AdminDonorListResponseDto,
} from './dto/donor-response.dto';

@ApiTags('Admin Donors')
@ApiHeader({
  name: 'accept-language',
  description:
    'Language preferred for response messages and errors; bilingual JSON data always includes ar and en',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@ApiBearerAuth('jwt')
@Controller('api/admin/donors')
@PreserveBilingualResponse()
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
export class DonorController {
  constructor(private readonly donorService: DonorService) {}

  @Get()
  @CheckAbilities({ action: 'read', subject: 'Donor' })
  @ApiOperation({ summary: 'List donor accounts for authorized staff' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'isSponsor', required: false, enum: ['true', 'false'] })
  @ApiOkResponse({ type: AdminDonorListResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or isSponsor filter',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:donors permission are required',
  })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isSponsor') isSponsor?: string,
    @I18nLang() lang = 'ar',
  ): Promise<AdminDonorListResponseDto> {
    return this.donorService.findAll(page, limit, isSponsor, lang);
  }

  @Get(':id/history')
  @CheckAbilities({ action: 'read', subject: 'Donor' })
  @ApiOperation({
    summary: 'Get current-year successful financial history for one donor',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 3,
    description: 'Donor record ID, not user account ID',
  })
  @ApiOkResponse({ type: AdminDonorHistoryResponseDto })
  @ApiBadRequestResponse({ description: 'The donor ID is invalid' })
  @ApiNotFoundResponse({ description: 'The donor was not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({
    description: 'Staff access and read:donors permission are required',
  })
  getHistory(
    @Param('id') id: string,
    @I18nLang() lang = 'ar',
  ): Promise<AdminDonorHistoryResponseDto> {
    return this.donorService.getHistory(id, lang);
  }
}
