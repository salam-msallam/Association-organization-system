import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Status } from '@prisma/client';
import { I18nLang } from 'nestjs-i18n';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { BeneficiaryService } from './beneficiary.service';

@ApiTags('Admin Beneficiaries')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for response data and messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/admin/beneficiaries')
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
export class AdminBeneficiariesController {
  constructor(private readonly beneficiaryService: BeneficiaryService) {}

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
  @ApiOperation({ summary: 'Get full beneficiary account details for admin' })
  findOne(@Param('id') id: string, @I18nLang() lang = 'ar') {
    return this.beneficiaryService.findOne(+id, lang);
  }

  private parsePositiveInteger(value: string | undefined, defaultValue: number): number {
    const parsed = value ? parseInt(value, 10) : defaultValue;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  }
}
