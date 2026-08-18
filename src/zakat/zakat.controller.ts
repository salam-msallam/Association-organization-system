import {
  Body,
  Controller,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DonorOnlyGuard } from '../guards/donor-only.guard';
import { CalculateZakatDto } from './dto/calculate-zakat.dto';
import { ZakatResultDto } from './dto/zakat-result.dto';
import { ZakatType } from './zakat-type.enum';
import { ZakatService } from './zakat.service';

@ApiTags('Zakat Calculator')
@ApiHeader({
  name: 'accept-language',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/zakat')
@UseGuards(JwtAuthGuard, DonorOnlyGuard)
@ApiBearerAuth('jwt')
export class ZakatController {
  constructor(private readonly zakatService: ZakatService) {}

  @Post('calculate')
  @ApiOperation({
    summary: 'Calculate money, gold, or silver zakat in USD for a donor',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: [ZakatType.MONEY, ZakatType.GOLD, ZakatType.SILVER],
    enumName: 'ZakatType',
    description: 'Select the zakat type',
  })
  @ApiOkResponse({ type: ZakatResultDto })
  @ApiBadRequestResponse({ description: 'Invalid or missing input' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Only donors can use this calculator' })
  calculate(
    @Query('type', new ParseEnumPipe(ZakatType)) type: ZakatType,
    @Body() dto: CalculateZakatDto,
    @I18nLang() lang = 'ar',
  ): ZakatResultDto {
    return this.zakatService.calculate(type, dto, lang);
  }
}
