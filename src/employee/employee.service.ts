import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserType } from '@prisma/client';
import { Employee } from './entities/employee.entity';

@Injectable()
export class EmployeeService {
  constructor(private prisma: PrismaService) {}
  async create(createEmployeeDto: CreateEmployeeDto) {
      const { roleId, dateOfBirth, personalPhoto, password, ...restData } = createEmployeeDto;

    const userExists = await this.prisma.user.findUnique({
      where: { email: restData.email },
    });
    if (userExists) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new BadRequestException('الدور المحدد غير موجود في النظام، يرجى اختيار دور صالح');
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        ...restData,
        password: hashedPassword,
        userType: UserType.EMPLOYEE, 
        countryName: 'Syria',       
        CountryCode: '963',        
        
        employee: {
          create: {
            personalPhoto,
            dateOfBirth: new Date(dateOfBirth),
          },
        },
        roles: {
          create: {
            roleId: roleId,
          },
        },
      },
      include: {
        employee: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }
  

  async findAll() {
    return this.prisma.user.findMany({
      where:{userType: UserType.EMPLOYEE},
      include: {
        employee:true,
        roles:{include:{role:true}},
      }
    });
  }

   async findOne(id: number) {
    const empolyee = await this.prisma.user.findFirst({
      where:{id,userType:UserType.EMPLOYEE},
      include:{
        employee:true,
        roles:{include:{role:true}},
      }
    });
    if(!empolyee){
      throw new BadRequestException('الموظف غير موجود');
    }
    return empolyee;
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
     await this.findOne(id);
     const {roleId, dateOfBirth,personalPhoto,email,...restData} =updateEmployeeDto;
     if(email){
      const emailExists = await this.prisma.user.findFirst({
        where:{
          email,
          NOT:{id}
        }
      });
      if(emailExists){
        throw new ConflictException('البريد الإلكتروني الجديد مستخدم بالفعل من قبل مستخدم آخر ');
      }
     }
     return this.prisma.user.update({
        where:{id},
        data:{
          ...restData,
          ...(email && {email}),
          employee:{
            update:{
              ...(personalPhoto && {personalPhoto}),
              ...(dateOfBirth && {dateOfBirth:new Date(dateOfBirth)}),
            },
          },
          ...(roleId &&{
            roles:{
              deleteMany:{},
              create:{
                roleId:roleId,
              },
            },
          }),
        },
        include:{
          employee:true,
          roles:{
            include:{role:true},
          },
        },
     });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.user.delete({
      where:{id},
    });
  }
}

