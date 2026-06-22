import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserType } from '@prisma/client';
import { Employee } from './entities/employee.entity';
import * as generatePassword from 'generate-password'; 

@Injectable()
export class EmployeeService {
  constructor(private prisma: PrismaService) {}
  async create(createEmployeeDto: CreateEmployeeDto) {
      const { roleIds, dateOfBirth, personalPhoto,...restData } = createEmployeeDto;

    const userExists = await this.prisma.user.findUnique({
      where: { email: restData.email },
    });
    if (userExists) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }


    const existingRoles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (existingRoles.length !== roleIds.length) {
      throw new BadRequestException('بعض الأدوار المحددة غير موجودة في النظام، يرجى التحقق من المدخلات');
    }

    const generatedPassword = generatePassword.generate({
      length: 8,        
      numbers: true,    
      uppercase: true,  
      lowercase: true,   
    });


    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    return this.prisma.user.create({
      data: {
        ...restData,
        password: hashedPassword,
        userType: UserType.EMPLOYEE, 
        countryName: 'Syria',       
        countryCode: '963',        
        
        employee: {
          create: {
            personalPhoto,
            dateOfBirth: new Date(dateOfBirth),
          },
        },
        roles: {
          create:roleIds.map((id) =>({
            roleId: id,
          })),
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
  

  async findAll(page: number = 1, limit: number = 10) {

    const skip = (page - 1) * limit;
    const [employees, totalCount] = await Promise.all([
    this.prisma.user.findMany({
      where: { userType: UserType.EMPLOYEE },
      skip: skip,   
      take: limit,  
      include: {
        employee: true,
        roles: { include: { role: true } },
      },
      orderBy: {
        id: 'desc', 
      },
    }),
    this.prisma.user.count({
      where: { userType: UserType.EMPLOYEE },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: employees,
    meta: {
      totalCount,   
      page,         
      limit,       
      totalPages,   
      hasNextPage: page < totalPages,     
      hasPreviousPage: page > 1,         
    },
  };
    // return this.prisma.user.findMany({
    //   where:{userType: UserType.EMPLOYEE},
    //   include: {
    //     employee:true,
    //     roles:{include:{role:true}},
    //   }
    // });
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
     const {roleIds, dateOfBirth,personalPhoto,email,...restData} =updateEmployeeDto;
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
          ...(roleIds &&{
            roles:{
              deleteMany:{},
              create: roleIds.map((id) => ({
                roleId: id,
              })),
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

