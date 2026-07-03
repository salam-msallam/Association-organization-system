import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { I18nLang, I18nService } from 'nestjs-i18n';

import { OrphanService } from './orphan.service';
import { CreateOrphanDto } from './dto/create-orphan.dto';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { AbilitiesGuard} from '../guards/abilities.guard';  
import { CheckAbilities } from '../decorators/abilities.decorator'; 
import { RoleGuard } from '../guards/role/role.guard';
import { RequireRole } from '../guards/decorators/require-role/require-role.decorator';

@Controller('orphan')
@ApiBearerAuth('jwt')
export class OrphanController {
  constructor(
    private readonly orphanService: OrphanService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), StaffOnlyGuard, RoleGuard, AbilitiesGuard)
  @ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for the response error/success messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },  
})
  @RequireRole('orphan_manager')
  @CheckAbilities({ action: 'create', subject: 'Orphan' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'FamilyStatement', maxCount: 1 }],
      { dest: './uploads/orphans' },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateOrphanDto })
  @ApiOperation({ summary: 'Create orphan record' })
  @ApiResponse({ status: 201, description: 'Orphan created successfully.' })
  async create(
    @Body() dto: CreateOrphanDto,
    @UploadedFiles()
    files: {
      FamilyStatement?: Array<{ path: string }>;
    },
    @I18nLang() lang: string,
  ) {
    const familyStatement = files?.FamilyStatement?.[0]?.path;

    if (!familyStatement) {
      throw new BadRequestException(
        this.i18n.t('orphan.FAMILY_STATEMENT_REQUIRED', { lang }),
      );
    }

    dto.FamilyStatement = familyStatement;

    return this.orphanService.create(dto, lang);
  }
}