import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
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
import { JwtService } from '@nestjs/jwt';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { LoginDto } from './dto/login.dto';
import { Status } from '@prisma/client';

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
      await this.whatsappService.sendOtp(otpResult.fullPhoneNumber, otpResult.code, lang);

      return { message: this.i18n.t('auth.OTP_SENT', { lang }) };
    } catch (error) {
      await this.clearPendingRegistration(dto.countryCode, dto.number);
      // if (otpResult) {
      //   await this.otpService.forceExpireOtp(otpResult.fullPhoneNumber, otpResult.code);
      // }
      throw error;
    }
  }

  async registerBeneficiary(
    dto: RegisterBeneficiaryDto,
    lang: string,
  ): Promise<{ message: string }> {
    await this.storePendingRegistration('BENEFICIARY', dto, lang);

    let otpResult: { code: string; fullPhoneNumber: string; expiresAt: Date } | undefined;
    try {
      otpResult = await this.otpService.createRegistrationOtp(dto.countryCode, dto.number);
      await this.whatsappService.sendOtp(otpResult.fullPhoneNumber, otpResult.code, lang);

      return { message: this.i18n.t('auth.OTP_SENT', { lang }) };
    } catch (error) {
      await this.clearPendingRegistration(dto.countryCode, dto.number);
      if (otpResult) {
        await this.otpService.forceExpireOtp(otpResult.fullPhoneNumber, otpResult.code);
      }
      throw error;
    }
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

  async login(loginDto: LoginDto , lang:string) {

    const { phoneNumber, password } = loginDto;
    const parsedNumber = parsePhoneNumberFromString(phoneNumber);
    
   
    if (!parsedNumber || !parsedNumber.isValid()) {
      throw new BadRequestException(this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }));
    }

    
    const countryCode = `+${parsedNumber.countryCallingCode}`; 
    const nationalNumber = parsedNumber.nationalNumber;       

    const user = await this.usersService.findByPhoneComponents(countryCode, nationalNumber);
      
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
