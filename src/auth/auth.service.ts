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
import { UsersService } from 'src/users/users.service';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { Status } from '@prisma/client';
import {LoginClientDto} from './dto/login_client.dto';

 

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

  async validateUser(loginDto: LoginDto) {
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
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    return user; 
  }

  async login(user: any) {
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
      message: 'تم تسجيل الدخول بنجاح',
      accessToken: this.jwtService.sign(payload), 
      roles: userRoles,
    };
  }



  private getRegistrationCacheKey(countryCode: string, number: string): string {
    const cleanCountry = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    return `registration:${cleanCountry}${number}`;
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

 async registerDonor(dto: RegisterDonorDto, lang: string): Promise<{ message: string }> {
  await this.storePendingRegistration('DONOR', dto, lang);

  let otpResult: { code: string; fullPhoneNumber: string; expiresAt: Date } | undefined;
  
  try {
    otpResult = await this.otpService.createRegistrationOtp(dto.countryCode, dto.number);
  } catch (error) {
    await this.clearPendingRegistration(dto.countryCode, dto.number);
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
    await this.storePendingRegistration('BENEFICIARY', dto, lang);

    let otpResult: { code: string; fullPhoneNumber: string; expiresAt: Date } | undefined;
  try {
      otpResult = await this.otpService.createRegistrationOtp(dto.countryCode, dto.number);
  } catch (error) {
    await this.clearPendingRegistration(dto.countryCode, dto.number);
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
    const cacheKey = this.getRegistrationCacheKey(countryCode, number);
    const data = await this.cacheManager.get<PendingRegistrationCache>(cacheKey);
    return data || null;
  }

  async deletePendingRegistration(countryCode: string, number: string): Promise<void> {
    const cacheKey = this.getRegistrationCacheKey(countryCode, number);
    await this.cacheManager.del(cacheKey);
  }

  async verifyRegistrationOtp(dto: VerifyOtpDto, lang: string) {
    const fullPhoneNumber = `${dto.countryCode}${dto.number}`;
    await this.otpService.verifyRegistrationOtp(fullPhoneNumber, dto.code, lang);

    const cacheKey = this.getRegistrationCacheKey(dto.countryCode, dto.number);
    const pendingRegistration = await this.cacheManager.get<PendingRegistrationCache>(cacheKey);

    if (!pendingRegistration) {
      throw new BadRequestException(this.i18n.t('auth.REGISTRATION_TIMEOUT', { lang }));
    }

    const pendingData = pendingRegistration.data;
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
              address: beneficiaryData.address,
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
        this.i18n.t('auth.errors.TRANSACTION_FAILED', { lang }),
      );
    }
  }

  async login_client(loginClientDto: LoginClientDto , lang:string) {

    const { phoneNumber, password } = loginClientDto;
    const parsedNumber = parsePhoneNumberFromString(phoneNumber);
    
   
    if (!parsedNumber || !parsedNumber.isValid()) {
      throw new BadRequestException(this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }));
    }

    
    const countryCode = `+${parsedNumber.countryCallingCode}`; 
    const nationalNumber = parsedNumber.nationalNumber;       

    // const user = await this.usersService.findByPhoneComponents(countryCode, nationalNumber);
    const user = await this.prisma.user.findFirst({
      where: {
        countryCode: countryCode, 
        number: nationalNumber,
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
