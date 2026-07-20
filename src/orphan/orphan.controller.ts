import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { I18nLang, I18nService } from 'nestjs-i18n';

import { OrphanService } from './orphan.service';
import { CreateOrphanDto } from './dto/create-orphan.dto';
import { UpdateOrphanDto } from './dto/update-orphan.dto';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { createUploadStorage } from '../interceptors/upload-storage.util';

@Controller('orphan')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for the response error/success messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
export class OrphanController {
  constructor(
    private readonly orphanService: OrphanService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
  @CheckAbilities({ action: 'create', subject: 'Orphan' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'FamilyStatement', maxCount: 1 }],
      { storage: createUploadStorage('./uploads/orphans') },
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

  @Get()
  @UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
  @CheckAbilities({ action: 'read', subject: 'Orphan' })
  @ApiOperation({ summary: 'Get paginated orphan records with optional support status filter' })
  @ApiResponse({ status: 200, description: 'Orphans fetched successfully.' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('supported') supported?: string,
    @I18nLang() lang?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    let supportedFilter: boolean | undefined;

    if (supported !== undefined) {
      if (supported === 'true') {
        supportedFilter = true;
      } else if (supported === 'false') {
        supportedFilter = false;
      } else {
        throw new BadRequestException(
          this.i18n.t('orphan.INVALID_SUPPORT_STATUS', { lang }),
        );
      }
    }

    return this.orphanService.findAll(pageNumber, limitNumber, supportedFilter, lang);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
  @CheckAbilities({ action: 'read', subject: 'Orphan' })
  @ApiOperation({ summary: 'Get orphan record by id' })
  @ApiResponse({ status: 200, description: 'Orphan fetched successfully.' })
  findOne(@Param('id') id: string, @I18nLang() lang: string) {
    return this.orphanService.findOne(+id, lang);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
  @CheckAbilities({ action: 'update', subject: 'Orphan' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'FamilyStatement', maxCount: 1 }],
      { storage: createUploadStorage('./uploads/orphans') },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateOrphanDto })
  @ApiOperation({ summary: 'Update orphan record' })
  @ApiResponse({ status: 200, description: 'Orphan updated successfully.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrphanDto,
    @UploadedFiles()
    files: {
      FamilyStatement?: Array<{ path: string }>;
    },
    @I18nLang() lang: string,
  ) {
    const familyStatement = files?.FamilyStatement?.[0]?.path;
    return this.orphanService.update(+id, dto, familyStatement, lang);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
  @CheckAbilities({ action: 'delete', subject: 'Orphan' })
  @ApiOperation({ summary: 'Delete orphan record' })
  @ApiResponse({ status: 200, description: 'Orphan deleted successfully.' })
  remove(@Param('id') id: string, @I18nLang() lang: string) {
    return this.orphanService.remove(+id, lang);
  }
}
