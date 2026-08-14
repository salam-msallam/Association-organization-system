import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  UserType as RegistrationUserType,
} from './interfaces/pending-registration.interface';
import { OtpService } from './otp.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { WhatsappService } from './whatsapp.service';
import { UsersService } from '../users/users.service';
import { Status, UserType as PrismaUserType } from '@prisma/client';
import { LoginClientDto } from './dto/login_client.dto';
import { ForgotPasswordRequestOtpDto } from './dto/forgot-password-request-otp.dto';
import { ForgotPasswordResetDto } from './dto/forgot-password-reset.dto';
import {
  normalizeFullPhoneNumber,
  normalizePhoneComponents,
} from './phone-number.util';
import { normalizeNotificationLanguage } from '../notifications/notification-language.util';
import { NotificationsService } from '../notifications/notifications.service';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
    private readonly i18n: I18nService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async validateUser(loginDto: LoginDto, lang = 'ar') {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.t('auth.INVALID_EMAIL_OR_PASSWORD', { lang }),
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        this.i18n.t('auth.INVALID_EMAIL_OR_PASSWORD', { lang }),
      );
    }

    if (
      user.userType !== PrismaUserType.ADMIN &&
      user.userType !== PrismaUserType.EMPLOYEE
    ) {
      throw new UnauthorizedException(
        this.i18n.t('auth.INVALID_EMAIL_OR_PASSWORD', { lang }),
      );
    }

    return user;
  }

  async login(user: any, lang = 'ar') {
    const payload = {
      sub: user.id,
      email: user.email,
      userType: user.userType,
    };

    let userRoles = [];
    if (user.roles && user.roles.length > 0) {
      userRoles = user.roles.map((userRole: any) => ({
        id: userRole.role.id,
        name: userRole.role.name,
        label: userRole.role.label,
        permissions: (userRole.role.permissions || []).map(
          ({ permission }: any) => ({
            id: permission.id,
            name: permission.name,
          }),
        ),
      }));
    }
    return {
      success: true,
      message: this.i18n.t('auth.LOGIN_SUCCESS', { lang }),
      accessToken: this.jwtService.sign(payload),
      userType: user.userType,
      roles: userRoles,
    };
  }

  logout(lang = 'ar'): { success: boolean; message: string } {
    return {
      success: true,
      message: this.i18n.t('auth.LOGOUT_SUCCESS', { lang }),
    };
  }

  private getRegistrationCacheKey(countryCode: string, number: string): string {
    return `registration:${countryCode}${number}`;
  }

  private normalizeRegistrationDto<
    T extends RegisterDonorDto | RegisterBeneficiaryDto,
  >(dto: T, lang: string): T {
    const normalizedPhone = normalizePhoneComponents(
      dto.countryCode,
      dto.number,
    );

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
    type: RegistrationUserType,
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
        this.i18n.t('auth.PHONE_ALREADY_REGISTERED', { lang }),
      );
    }

    const existingUserByEmail = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUserByEmail) {
      throw new BadRequestException(
        this.i18n.t('auth.EMAIL_ALREADY_REGISTERED', { lang }),
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

  private async clearPendingRegistration(
    countryCode: string,
    number: string,
  ): Promise<void> {
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

  private async findEligiblePasswordResetUser(
    phoneNumber: string,
    lang: string,
  ) {
    const normalizedPhone = normalizeFullPhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      throw new BadRequestException(
        this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }),
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        countryCode: normalizedPhone.countryCode,
        number: normalizedPhone.number,
      },
      include: {
        beneficiary: true,
        donor: true,
        employee: true,
      },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.USER_NOT_FOUND', { lang }));
    }

    if (user.userType === PrismaUserType.DONOR) {
      if (!user.donor) {
        throw new NotFoundException(
          this.i18n.t('auth.USER_NOT_FOUND', { lang }),
        );
      }

      return { user, fullPhoneNumber: normalizedPhone.e164 };
    }

    if (user.userType === PrismaUserType.BENEFICIARY) {
      if (!user.beneficiary) {
        throw new NotFoundException(
          this.i18n.t('auth.USER_NOT_FOUND', { lang }),
        );
      }

      if (user.beneficiary.status !== Status.ACCEPTED) {
        throw new ForbiddenException(
          this.i18n.t('auth.ACCOUNT_NOT_APPROVED_YET', { lang }),
        );
      }

      return { user, fullPhoneNumber: normalizedPhone.e164 };
    }

    if (user.userType === PrismaUserType.EMPLOYEE) {
      if (!user.employee) {
        throw new NotFoundException(
          this.i18n.t('auth.USER_NOT_FOUND', { lang }),
        );
      }

      return { user, fullPhoneNumber: normalizedPhone.e164 };
    }

    if (user.userType === PrismaUserType.ADMIN) {
      return { user, fullPhoneNumber: normalizedPhone.e164 };
    }

    throw new NotFoundException(this.i18n.t('auth.USER_NOT_FOUND', { lang }));
  }

  async registerDonor(
    dto: RegisterDonorDto,
    lang: string,
  ): Promise<{ message: string }> {
    const normalizedDto = this.normalizeRegistrationDto(dto, lang);
    await this.storePendingRegistration('DONOR', normalizedDto, lang);

    let otpResult:
      | { code: string; fullPhoneNumber: string; expiresAt: Date }
      | undefined;

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
      await this.whatsappService.sendOtp(
        otpResult.fullPhoneNumber,
        otpResult.code,
        lang,
      );
    } catch (whatsappError) {
      console.error(
        'WhatsApp sending failed, but OTP is kept in DB for testing:',
      );
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

    let otpResult:
      | { code: string; fullPhoneNumber: string; expiresAt: Date }
      | undefined;
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
      await this.whatsappService.sendOtp(
        otpResult.fullPhoneNumber,
        otpResult.code,
        lang,
      );
    } catch (whatsappError) {
      console.error(
        'WhatsApp sending failed, but OTP is kept in DB for testing:',
      );
      return { message: this.i18n.t('auth.WHATSAPP_SENDING_FAILED', { lang }) };
    }

    return { message: this.i18n.t('auth.OTP_SENT', { lang }) };
  }

  async requestPasswordResetOtp(
    dto: ForgotPasswordRequestOtpDto,
    lang: string,
  ): Promise<{ message: string }> {
    const { user, fullPhoneNumber } = await this.findEligiblePasswordResetUser(
      dto.phoneNumber,
      lang,
    );

    const otpResult = await this.otpService.createPasswordResetOtp(
      user.id,
      fullPhoneNumber,
      lang,
    );

    try {
      await this.whatsappService.sendOtp(
        otpResult.fullPhoneNumber,
        otpResult.code,
        lang,
      );
    } catch (whatsappError) {
      console.error(
        'WhatsApp sending failed, but password reset OTP is kept in DB for testing:',
      );
      return { message: this.i18n.t('auth.WHATSAPP_SENDING_FAILED', { lang }) };
    }

    return { message: this.i18n.t('auth.OTP_SENT', { lang }) };
  }

  async resetForgottenPassword(
    dto: ForgotPasswordResetDto,
    lang: string,
  ): Promise<{ success: boolean; message: string }> {
    const otpRecord = await this.otpService.verifyPasswordResetOtp(
      dto.code,
      lang,
    );
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    try {
      await this.prisma.$transaction(async (tx) => {
        const isOtpConsumed = await this.otpService.markPasswordResetOtpAsUsed(
          otpRecord.id,
          otpRecord.userId,
          tx,
        );

        if (!isOtpConsumed) {
          throw new BadRequestException(
            this.i18n.t('auth.OTP_INVALID_OR_CONSUMED', { lang }),
          );
        }

        await tx.user.update({
          where: { id: otpRecord.userId },
          data: { password: hashedPassword },
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Password reset transaction failed:', error);
      throw new InternalServerErrorException(
        this.i18n.t('auth.PASSWORD_RESET_FAILED', { lang }),
      );
    }

    return {
      success: true,
      message: this.i18n.t('auth.PASSWORD_RESET_SUCCESS', { lang }),
    };
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
    const data =
      await this.cacheManager.get<PendingRegistrationCache>(cacheKey);
    return data || null;
  }

  async deletePendingRegistration(
    countryCode: string,
    number: string,
  ): Promise<void> {
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
    const normalizedPhone = normalizePhoneComponents(
      dto.countryCode,
      dto.number,
    );

    if (!normalizedPhone) {
      throw new BadRequestException(
        this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }),
      );
    }

    const fullPhoneNumber = normalizedPhone.e164;
    await this.otpService.verifyRegistrationOtp(
      fullPhoneNumber,
      dto.code,
      lang,
    );

    const cacheKey = this.getRegistrationCacheKey(
      normalizedPhone.countryCode,
      normalizedPhone.number,
    );
    const pendingRegistration =
      await this.cacheManager.get<PendingRegistrationCache>(cacheKey);

    if (!pendingRegistration) {
      throw new BadRequestException(
        this.i18n.t('auth.REGISTRATION_TIMEOUT', { lang }),
      );
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
            notificationRegistrationId: dto.registrationId,
            notificationLanguage: normalizeNotificationLanguage(lang),
          },
        });

        if (pendingRegistration.type === 'DONOR') {
          const donorData = pendingData as RegisterDonorDto;
          await tx.donor.create({
            data: {
              userId: newUser.id,
              zipCode: donorData.zipCode,
              isSponsor: false,
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
              dateOfBirth: new Date(beneficiaryData.dateOfBirth),
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

      if (pendingRegistration.type === 'BENEFICIARY') {
        await this.notifyStaffAboutPendingBeneficiary(result.id);
      }

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

  private async notifyStaffAboutPendingBeneficiary(
    beneficiaryUserId: number,
  ): Promise<void> {
    try {
      await this.notificationsService.createAndSendToPermission(
        'status:beneficiaries',
        {
          title: {
            ar: 'مستفيد جديد بانتظار المراجعة',
            en: 'New beneficiary awaiting review',
          },
          message: {
            ar: 'تم تسجيل حساب مستفيد جديد ويحتاج إلى مراجعة بياناته.',
            en: 'A new beneficiary account has been registered and requires review.',
          },
          targetType: 'BENEFICIARY_REVIEW',
          targetId: beneficiaryUserId,
        },
      );
    } catch {
      this.logger.warn(
        `Failed to notify staff about pending beneficiary user ${beneficiaryUserId}`,
      );
    }
  }

  async login_client(loginClientDto: LoginClientDto, lang: string) {
    const { phoneNumber, password } = loginClientDto;
    const normalizedPhone = normalizeFullPhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      throw new BadRequestException(
        this.i18n.t('auth.INVALID_PHONE_NUMBER', { lang }),
      );
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
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        this.i18n.t('auth.INVALID_PHONE_OR_PASSWORD', { lang }),
      );
    }
    const isPasswordMatching = await bcrypt.compare(password, user.password);
    if (!isPasswordMatching) {
      throw new UnauthorizedException(
        this.i18n.t('auth.INVALID_PASSWORD', { lang }),
      );
    }

    if (user.userType === 'BENEFICIARY') {
      if (user.beneficiary?.status === Status.REJECTED) {
        throw new ForbiddenException({
          statusCode: 403,
          message: this.i18n.t('auth.ACCOUNT_REJECTED', { lang }),
          error: 'Forbidden',
          rejectionReason: user.beneficiary.rejectionReason,
        });
      }

      if (!user.beneficiary || user.beneficiary.status !== Status.ACCEPTED) {
        throw new ForbiddenException(
          this.i18n.t('auth.ACCOUNT_NOT_APPROVED_YET', { lang }),
        );
      }
    }

    const payload = {
      sub: user.id,
      countryCode: user.countryCode,
      number: user.number,
      type: user.userType,
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
// تمام، منبسّط التصميم وما منعمل جدول `NotificationDevice`.

// بما أن كل مستخدم عندك سيستخدم جهة واحدة غالباً:

// - المتبرع والمستفيد: تطبيق Flutter.
// - الموظف والإدارة: Dashboard React.

// سنضيف معرّف Firebase مباشرة داخل جدول `User`:

// ```prisma
// enum NotificationPlatform {
//   ANDROID
//   IOS
//   WEB
// }

// model User {
//   // الحقول الموجودة...

//   notificationRegistrationId String?               @unique @db.VarChar(512)
//   notificationPlatform       NotificationPlatform?
//   notifications              Notification[]
// }
// ```

// ويصبح جدول الإشعارات مربوطاً بالمستخدم:

// ```prisma
// model Notification {
//   id         Int       @id @default(autoincrement())
//   userId     Int
//   title      Json
//   message    Json
//   targetType String?
//   targetId   Int?
//   isRead     Boolean   @default(false)
//   readAt     DateTime?
//   createdAt  DateTime  @default(now())

//   user User @relation(fields: [userId], references: [id], onDelete: Cascade)

//   @@index([userId, isRead, createdAt])
// }
// ```

// طريقة العمل:

// ```text
// Flutter أو React يحصل على registrationId من Firebase
//                        ↓
// يرسله إلى NestJS
//                        ↓
// NestJS يخزّنه ضمن User
//                        ↓
// عند إنشاء إشعار، NestJS يرسله لهذا المعرّف
// ```

// لكن لازم تكوني عارفة نتيجة هذا القرار: إذا سجّل المستخدم دخوله من جهاز جديد، المعرّف الجديد سيستبدل القديم، وبالتالي تصل الإشعارات إلى آخر جهاز سجّل فقط. وهذا مناسب حسب طلبك.

// الخطوة الثانية المعدّلة ستكون:

// 1. إضافة حقول Firebase إلى `User`.
// 2. ربط `Notification` مع `User`.
// 3. إنشاء migration.
// 4. نوقف ونراجع تصميم قاعدة البيانات قبل إنشاء أي API.

// لن أنفّذها الآن حتى تطلبي البدء بالخطوة الثانية.
