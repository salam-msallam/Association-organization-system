import { Controller, Get, Post, Body, Patch, UsePipes, Param, Delete, ValidationPipe, UseGuards, Query } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AbilitiesGuard} from '../guards/abilities.guard'; 
import { CheckAbilities } from '../decorators/abilities.decorator'; 
import { AuthGuard } from '@nestjs/passport'; 
import { ApiBearerAuth} from '@nestjs/swagger'; 


@Controller('employee')
@UseGuards(AuthGuard('jwt')) 
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'create', subject: 'Employee' })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() createEmployeeDto: CreateEmployeeDto) {
    const employee = await this.employeeService.create(createEmployeeDto);
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
  @UsePipes(new ValidationPipe({ whitelist: true }))
  update(@Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(+id, updateEmployeeDto);
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @CheckAbilities({ action: 'delete', subject: 'Employee' })
  remove(@Param('id') id: string) {
    return this.employeeService.remove(+id);
  }
}