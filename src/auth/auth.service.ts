import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { I18nService } from 'nestjs-i18n';
import { RegisterBeneficiaryDto } from './dto/register-beneficiary.dto';
import { RegisterDonorDto } from './dto/register-donor.dto';
import {
  PendingRegistrationCache,
  UserType,
} from './interfaces/pending-registration.interface';
import { OtpService } from './otp.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { WhatsappService } from './whatsapp.service';
import { UsersService } from '../users/users.service';
import { Status } from '@prisma/client';
import {LoginClientDto} from './dto/login_client.dto';
import {
  normalizeFullPhoneNumber,
  normalizePhoneComponents,
} from './phone-number.util';

 

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
    private readonly i18n: I18nService,
    private usersService: UsersService, 
    private jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDto, lang = 'ar') {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ 
    where: { email },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
    });
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_EMAIL_OR_PASSWORD', { lang }));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_EMAIL_OR_PASSWORD', { lang }));
    }

    return user; 
  }

  async login(user: any, lang = 'ar') {
    const payload = { 
      sub: user.id, 
      email: user.email, 
      userType: user.userType 
    };

    let userRoles = [];
   if (user.roles && user.roles.length > 0) {
    userRoles = user.roles.map((userRole: any) => ({
      id: userRole.role.id,
      name: userRole.role.name,
      label: userRole.role.label,
    }));
  }
    return {
      success: true,
      message: this.i18n.t('auth.LOGIN_SUCCESS', { lang }),
      accessToken: this.jwtService.sign(payload), 
      roles: userRoles,
    };
  }



  private getRegistrationCacheKey(countryCode: string, number: string): string {
    return `registration:${countryCode}${number}`;
  }

  private normalizeRegistrationDto<T extends RegisterDonorDto | RegisterBeneficiaryDto>(
    dto: T,
    lang: string,
  ): T {
    const normalizedPhone = normalizePhoneComponents(dto.countryCode, dto.number);

    if (!normalizedPhone) {
      throw new BadRequestException(
        this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }),
      );
    }

    return {
      ...dto,
      countryCode: normalizedPhone.countryCode,
      number: normalizedPhone.number,
    };
  }

  private async storePendingRegistration(
    type: UserType,
    dto: RegisterDonorDto | RegisterBeneficiaryDto,
    lang: string,
  ): Promise<string> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        countryCode: dto.countryCode,
        number: dto.number,
      },
    });
  if (existingUser) {
    throw new BadRequestException(
      this.i18n.t('auth.PHONE_ALREADY_REGISTERED', { lang })
    );
  }

  const existingUserByEmail = await this.prisma.user.findUnique({
  where: {
    email: dto.email, 
  },
});

if (existingUserByEmail) {
  throw new BadRequestException(
    this.i18n.t('auth.EMAIL_ALREADY_REGISTERED', { lang }) 
  );
}
    const cacheKey = this.getRegistrationCacheKey(dto.countryCode, dto.number);

    const cacheValue: PendingRegistrationCache = {
      type,
      data: dto,
      createdAt: new Date().toISOString(),
    };

    await this.cacheManager.set(cacheKey, cacheValue);
    return cacheKey;
  }

  private async clearPendingRegistration(countryCode: string, number: string): Promise<void> {
    const cacheKey = this.getRegistrationCacheKey(countryCode, number);
    await this.cacheManager.del(cacheKey);
  }

  private parseJson(value: any, fieldName: string, lang: string) {
    if (typeof value === 'object') return value;

    try {
      return JSON.parse(value);
    } catch {
      throw new BadRequestException(
        this.i18n.t('auth.INVALID_JSON_FIELD', {
          lang,
          args: { field: fieldName },
        }),
      );
    }
  }

 async registerDonor(dto: RegisterDonorDto, lang: string): Promise<{ message: string }> {
  const normalizedDto = this.normalizeRegistrationDto(dto, lang);
  await this.storePendingRegistration('DONOR', normalizedDto, lang);

  let otpResult: { code: string; fullPhoneNumber: string; expiresAt: Date } | undefined;
  
  try {
    otpResult = await this.otpService.createRegistrationOtp(
      normalizedDto.countryCode,
      normalizedDto.number,
    );
  } catch (error) {
    await this.clearPendingRegistration(
      normalizedDto.countryCode,
      normalizedDto.number,
    );
    throw error;
  }

  try {
    await this.whatsappService.sendOtp(otpResult.fullPhoneNumber, otpResult.code, lang);
  } catch (whatsappError) {
    console.error('WhatsApp sending failed, but OTP is kept in DB for testing:');
    return { message: this.i18n.t('auth.WHATSAPP_SENDING_FAILED', { lang }) };
  }

  return { message: this.i18n.t('auth.OTP_SENT', { lang }) };
}

  async registerBeneficiary(
    dto: RegisterBeneficiaryDto,
    lang: string,
  ): Promise<{ message: string }> {
    const normalizedDto = this.normalizeRegistrationDto(dto, lang);
    await this.storePendingRegistration('BENEFICIARY', normalizedDto, lang);

    let otpResult: { code: string; fullPhoneNumber: string; expiresAt: Date } | undefined;
  try {
      otpResult = await this.otpService.createRegistrationOtp(
        normalizedDto.countryCode,
        normalizedDto.number,
      );
  } catch (error) {
    await this.clearPendingRegistration(
      normalizedDto.countryCode,
      normalizedDto.number,
    );
    throw error;
  }
  try {
    await this.whatsappService.sendOtp(otpResult.fullPhoneNumber, otpResult.code, lang);
  } catch (whatsappError) {
    console.error('WhatsApp sending failed, but OTP is kept in DB for testing:');
    return { message: this.i18n.t('auth.WHATSAPP_SENDING_FAILED', { lang }) };
  }

  return { message: this.i18n.t('auth.OTP_SENT', { lang }) };
  }

  async getPendingRegistration(
    countryCode: string,
    number: string,
  ): Promise<PendingRegistrationCache | null> {
    const normalizedPhone = normalizePhoneComponents(countryCode, number);

    if (!normalizedPhone) {
      return null;
    }

    const cacheKey = this.getRegistrationCacheKey(
      normalizedPhone.countryCode,
      normalizedPhone.number,
    );
    const data = await this.cacheManager.get<PendingRegistrationCache>(cacheKey);
    return data || null;
  }

  async deletePendingRegistration(countryCode: string, number: string): Promise<void> {
    const normalizedPhone = normalizePhoneComponents(countryCode, number);

    if (!normalizedPhone) {
      return;
    }

    const cacheKey = this.getRegistrationCacheKey(
      normalizedPhone.countryCode,
      normalizedPhone.number,
    );
    await this.cacheManager.del(cacheKey);
  }

  async verifyRegistrationOtp(dto: VerifyOtpDto, lang: string) {
    const normalizedPhone = normalizePhoneComponents(dto.countryCode, dto.number);

    if (!normalizedPhone) {
      throw new BadRequestException(this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }));
    }

    const fullPhoneNumber = normalizedPhone.e164;
    await this.otpService.verifyRegistrationOtp(fullPhoneNumber, dto.code, lang);

    const cacheKey = this.getRegistrationCacheKey(
      normalizedPhone.countryCode,
      normalizedPhone.number,
    );
    const pendingRegistration = await this.cacheManager.get<PendingRegistrationCache>(cacheKey);

    if (!pendingRegistration) {
      throw new BadRequestException(this.i18n.t('auth.REGISTRATION_TIMEOUT', { lang }));
    }

    const pendingData = pendingRegistration.data;
    const beneficiaryAddress =
      pendingRegistration.type === 'BENEFICIARY'
        ? this.parseJson(
            (pendingData as RegisterBeneficiaryDto).address,
            'address',
            lang,
          )
        : undefined;
    const hashedPassword = await bcrypt.hash(pendingData.password, 10);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            firstName: pendingData.firstName,
            lastName: pendingData.lastName,
            email: pendingData.email,
            number: pendingData.number,
            countryName: pendingData.countryName,
            countryCode: pendingData.countryCode,
            gender: pendingData.gender,
            password: hashedPassword,
            userType: pendingRegistration.type,
          },
        });

        if (pendingRegistration.type === 'DONOR') {
          const donorData = pendingData as RegisterDonorDto;
          await tx.donor.create({
            data: {
              userId: newUser.id,
              zipCode: donorData.zipCode,
              isSponsor:false,
            },
          });
        }

        if (pendingRegistration.type === 'BENEFICIARY') {
          const beneficiaryData = pendingData as RegisterBeneficiaryDto;
          await tx.beneficiary.create({
            data: {
              userId: newUser.id,
              personalPhoto: beneficiaryData.personalPhoto,
              familyStatement: beneficiaryData.familyStatement,
              address: beneficiaryAddress,
              socialStatus: beneficiaryData.socialStatus,
              isUnemployed: beneficiaryData.isUnemployed,
              numberOfChildren: beneficiaryData.numberOfChildren,
              monthlyIncome: beneficiaryData.monthlyIncome ?? 0,
            },
          });
        }

        return newUser;
      });

      await this.otpService.markOtpAsUsed(fullPhoneNumber, dto.code);
      await this.cacheManager.del(cacheKey);

      return {
        success: true,
        message: this.i18n.t('auth.REGISTER_SUCCESS', { lang }),
        userId: result.id,
      };
    } catch (error) {
      console.error('Registration transaction failed:', error);

      throw new InternalServerErrorException(
        this.i18n.t('auth.TRANSACTION_FAILED', { lang }),
      );
    }
  }

  async login_client(loginClientDto: LoginClientDto , lang:string) {

    const { phoneNumber, password } = loginClientDto;
    const normalizedPhone = normalizeFullPhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      throw new BadRequestException(this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }));
    }

    // const user = await this.usersService.findByPhoneComponents(countryCode, nationalNumber);
    const user = await this.prisma.user.findFirst({
      where: {
        countryCode: normalizedPhone.countryCode, 
        number: normalizedPhone.number,
      },
      include: {
        beneficiary: true, 
        donor: true,
      }
    });
      
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_PHONE_OR_PASSWORD', { lang }));
    }
    if (user.userType === 'BENEFICIARY') {
  if (!user.beneficiary || user.beneficiary.status !== Status.ACCEPTED) {
    throw new ForbiddenException(
      this.i18n.t('auth.ACCOUNT_NOT_APPROVED_YET', { lang })
    );
  }
}

    const isPasswordMatching = await bcrypt.compare(password, user.password);
    if (!isPasswordMatching) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_PASSWORD',{lang}));
    }

    
    const payload = { 
      sub: user.id, 
      countryCode: user.countryCode, 
      number: user.number,
      type: user.userType
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        firstNama: user.firstName,
        lastName: user.lastName,
        countryCode: user.countryCode,
        number: user.number,
        type: user.userType,
      },
    };
  }
}
