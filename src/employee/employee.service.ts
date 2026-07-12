import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as generatePassword from 'generate-password';
import { I18nService } from 'nestjs-i18n';
import { WhatsappService } from '../auth/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly i18n: I18nService,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto, fileUrl: string, lang = 'ar') {
    const { roleIds, dateOfBirth, ...restData } = createEmployeeDto;

    const userExists = await this.prisma.user.findUnique({
      where: { email: restData.email },
    });

    if (userExists) {
      throw new ConflictException(this.i18n.t('employee.EMAIL_ALREADY_USED', { lang }));
    }

    const phoneExists = await this.prisma.user.findUnique({
      where: {
        countryCode_number: {
          countryCode: '+963',
          number: restData.number,
        },
      },
    });

    if (phoneExists) {
      throw new ConflictException(this.i18n.t('employee.PHONE_ALREADY_USED', { lang }));
    }

    const existingRoles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });

    if (existingRoles.length !== roleIds.length) {
      throw new BadRequestException(this.i18n.t('employee.SOME_ROLES_NOT_FOUND', { lang }));
    }

    const generatedPassword = generatePassword.generate({
      length: 8,
      numbers: true,
      uppercase: true,
      lowercase: true,
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `Generated employee password for ${restData.email} password is : ${generatedPassword}`,
      );
    }

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    const employee = await this.prisma.user.create({
      data: {
        ...restData,
        password: hashedPassword,
        userType: UserType.EMPLOYEE,
        countryName: 'Syria',
        countryCode: '+963',
        employee: {
          create: {
            personalPhoto: fileUrl,
            dateOfBirth: new Date(dateOfBirth),
          },
        },
        roles: {
          create: roleIds.map((id) => ({
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

    try {
      const fullPhoneNumber = `${employee.countryCode}${employee.number}`;

      await this.whatsappService.sendEmployeeCredentials(
        fullPhoneNumber,
        employee.email,
        generatedPassword,
        lang,
      );
    } catch (error) {
      this.logger.error(
        `Employee created but WhatsApp credentials failed for ${employee.email}`,
        error,
      );
    }

    return employee;
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [employees, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where: { userType: UserType.EMPLOYEE },
        skip,
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
  }

  async findOne(id: number, lang = 'ar') {
    const employee = await this.prisma.user.findFirst({
      where: { id, userType: UserType.EMPLOYEE },
      include: {
        employee: true,
        roles: { include: { role: true } },
      },
    });

    if (!employee) {
      throw new BadRequestException(this.i18n.t('employee.EMPLOYEE_NOT_FOUND', { lang }));
    }

    return employee;
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto, fileUrl?: string, lang = 'ar') {
    await this.findOne(id, lang);
    const { roleIds, dateOfBirth, personalPhoto, email, ...restData } = updateEmployeeDto;

    if (email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          email,
          NOT: { id },
        },
      });

      if (emailExists) {
        throw new ConflictException(this.i18n.t('employee.NEW_EMAIL_ALREADY_USED', { lang }));
      }
    }

    if (restData.number) {
      const phoneExists = await this.prisma.user.findFirst({
        where: {
          countryCode: '+963',
          number: restData.number,
          NOT: { id },
        },
      });

      if (phoneExists) {
        throw new ConflictException(this.i18n.t('employee.PHONE_ALREADY_USED', { lang }));
      }
    }

    if (roleIds && roleIds.length > 0) {
      const existingRoles = await this.prisma.role.findMany({
        where: { id: { in: roleIds } },
      });

      if (existingRoles.length !== roleIds.length) {
        throw new BadRequestException(this.i18n.t('employee.SOME_ROLES_NOT_FOUND', { lang }));
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...restData,
        ...(email && { email }),
        employee: {
          update: {
            ...(fileUrl && { personalPhoto: fileUrl }),
            ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          },
        },
        ...(roleIds && {
          roles: {
            deleteMany: {},
            create: roleIds.map((roleId) => ({
              roleId,
            })),
          },
        }),
      },
      include: {
        employee: true,
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async remove(id: number, lang = 'ar') {
    await this.findOne(id, lang);
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      success: true,
      message: this.i18n.t('employee.DELETE_SUCCESS', { lang }),
    };
  }
}
