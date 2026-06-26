import { Controller, Get, Post, Body, Patch, UsePipes, Param, Delete, ValidationPipe, UseGuards, Query } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AbilitiesGuard} from '../guards/abilities.guard'; 
import { CheckAbilities } from '../decorators/abilities.decorator'; 
import { AuthGuard } from '@nestjs/passport'; 
import { ApiBearerAuth ,ApiBody, ApiOperation,ApiConsumes} from '@nestjs/swagger'; 
import { UseInterceptors, UploadedFile, BadRequestException} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('employee')
@UseGuards(AuthGuard('jwt')) 
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

 @Post()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'create', subject: 'Employee' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('personalPhoto', {
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
        return callback(new BadRequestException('يُسمح برفع الصور فقط'), false);
      }
      callback(null, true);
    },
  }))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() createEmployeeDto: CreateEmployeeDto, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('الصورة الشخصية للموظف مطلوبة');
    }

    const fileUrl = `http://localhost:3000/uploads/employees/${file.filename}`;
    const employee = await this.employeeService.create(createEmployeeDto, fileUrl);
    
    return {
      success: true,
      message: 'تم إنشاء حساب الموظف بنجاح وإسناد الدور المطلوب له',
      data: employee,
    };
  }

  @Get()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Employee' })
  findAll(@Query('page') page?: string,@Query('limit') limit?: string) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.employeeService.findAll(pageNumber,limitNumber);
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'read', subject: 'Employee' })
  findOne(@Param('id') id: string) {
    return this.employeeService.findOne(+id);
  }

 @Patch(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'update', subject: 'Employee' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('personalPhoto', { 
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
        return callback(new BadRequestException('يُسمح برفع الصور فقط'), false);
      }
      callback(null, true);
    },
  }))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @Param('id') id: string, 
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @UploadedFile() file: any 
  ) {
   let fileUrl: string | undefined = undefined;
    
    if (file) {
      fileUrl = `http://localhost:3000/uploads/employees/${file.filename}`;
    }

    const employee = await this.employeeService.update(+id, updateEmployeeDto, fileUrl);
    
    return {
      success: true,
      message: 'تم تحديث بيانات الموظف بنجاح',
      data: employee,
    };
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'delete', subject: 'Employee' })
  remove(@Param('id') id: string) {
    return this.employeeService.remove(+id);
  }

}