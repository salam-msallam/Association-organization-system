import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { I18nContext, I18nLang, I18nService } from 'nestjs-i18n';
import { CheckAbilities } from '../decorators/abilities.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeService } from './employee.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const translateEmployeeMessage = (key: string, fallback: string) =>
  I18nContext.current()?.t(`employee.${key}`) ?? fallback;

@Controller('employee')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for the response error/success messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@UseGuards(AuthGuard('jwt'), StaffOnlyGuard, AbilitiesGuard)
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'create', subject: 'Employee' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('personalPhoto', {
      storage: diskStorage({
        destination: './uploads/employees',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(
            new BadRequestException(
              translateEmployeeMessage('ONLY_IMAGES_ALLOWED', 'Only image uploads are allowed.'),
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @UploadedFile() file: any,
    @I18nLang() lang: string,
  ) {
    if (!file) {
      throw new BadRequestException(this.i18n.t('employee.PERSONAL_PHOTO_REQUIRED', { lang }));
    }

    const fileUrl = `http://localhost:3000/uploads/employees/${file.filename}`;
    const employee = await this.employeeService.create(createEmployeeDto, fileUrl, lang);

    return {
      success: true,
      message: this.i18n.t('employee.CREATE_SUCCESS', { lang }),
      data: employee,
    };
  }

  @Get()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Employee' })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.employeeService.findAll(pageNumber, limitNumber);
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Employee' })
  findOne(@Param('id') id: string, @I18nLang() lang: string) {
    return this.employeeService.findOne(+id, lang);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'update', subject: 'Employee' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('personalPhoto', {
      storage: diskStorage({
        destination: './uploads/employees',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(
            new BadRequestException(
              translateEmployeeMessage('ONLY_IMAGES_ALLOWED', 'Only image uploads are allowed.'),
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @UploadedFile() file: any,
    @I18nLang() lang: string,
  ) {
    const fileUrl = file ? `http://localhost:3000/uploads/employees/${file.filename}` : undefined;
    const employee = await this.employeeService.update(+id, updateEmployeeDto, fileUrl, lang);

    return {
      success: true,
      message: this.i18n.t('employee.UPDATE_SUCCESS', { lang }),
      data: employee,
    };
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'delete', subject: 'Employee' })
  remove(@Param('id') id: string, @I18nLang() lang: string) {
    return this.employeeService.remove(+id, lang);
  }
}
