import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service'; 
import { I18nService } from 'nestjs-i18n';

type OtpWriteClient = PrismaService | Prisma.TransactionClient;

export interface PasswordResetOtpRecord {
  id: number;
  userId: number;
  number: string;
  code: string;
  expiresAt: Date;
}

@Injectable()
export class OtpService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly i18n: I18nService
    ) {}

    private generateOtpCode(): string {
      return Math.floor(1000 + Math.random() * 9000).toString();
    }

    private async generateUniquePasswordResetCode(lang: string): Promise<string> {
      const maxAttempts = 50;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = this.generateOtpCode();
        const existingOtp = await this.prisma.otp.findFirst({
          where: {
            code,
            userId: { not: null },
            expiresAt: { gt: new Date() },
            isUsed: false,
          },
          select: { id: true },
        });

        if (!existingOtp) {
          return code;
        }
      }

      throw new InternalServerErrorException(
        this.i18n.t('auth.OTP_GENERATION_FAILED', { lang }),
      );
    }

    async createRegistrationOtp(
      countryCode: string,
      number: string,
    ): Promise<{ code: string; fullPhoneNumber: string; expiresAt: Date }> {
   
    const cleanCountry = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    const fullPhoneNumber = `${cleanCountry}${number}`;

   
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const code = this.generateOtpCode();


    // 4. Clean up / Invalidate previous unused OTPs for this number
    // We assume your table has an 'isUsed' or similar flag, or we simply invalidate them by expiring them out.
    // If your schema has an 'isUsed' boolean field, you can do:
    await this.prisma.otp.updateMany({
      where: {
    number: fullPhoneNumber,
    userId: null,
    expiresAt: { gt: new Date() }, 
    isUsed: false, 
  },
  data: {
    expiresAt: new Date(), 
  },
    });

    // 5. Create the new Otp record
    await this.prisma.otp.create({
      data: {
        userId: null,
        number: fullPhoneNumber,
        code,
        expiresAt,
      },
    });


    return { code, fullPhoneNumber, expiresAt };
  }

  async createPasswordResetOtp(
    userId: number,
    fullPhoneNumber: string,
    lang: string,
  ): Promise<{ code: string; fullPhoneNumber: string; expiresAt: Date }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await this.prisma.otp.updateMany({
      where: {
        userId,
        number: fullPhoneNumber,
        expiresAt: { gt: now },
        isUsed: false,
      },
      data: {
        expiresAt: now,
      },
    });

    const code = await this.generateUniquePasswordResetCode(lang);

    await this.prisma.otp.create({
      data: {
        userId,
        number: fullPhoneNumber,
        code,
        expiresAt,
      },
    });

    return { code, fullPhoneNumber, expiresAt };
  }


  async forceExpireOtp(fullPhoneNumber: string, code: string): Promise<void> {
    await this.prisma.otp.updateMany({
      where: { number: fullPhoneNumber, code, userId: null },
      data: { expiresAt: new Date() },
    });
  }
  async verifyRegistrationOtp(fullPhoneNumber: string, code: string, lang: string) {
    const otpRecord = await this.prisma.otp.findFirst({
    where: { 
      number: fullPhoneNumber, 
      code,
      isUsed: false 
    },
    orderBy: {
      createdAt: 'desc', 
    },
  });

    if (!otpRecord) {
      throw new BadRequestException(this.i18n.t('auth.OTP_NOT_FOUND', { lang }));
    }

    if (otpRecord.isUsed) {
      throw new BadRequestException(this.i18n.t('auth.OTP_ALREADY_USED', { lang }));
    }

if (Date.now() > new Date(otpRecord.expiresAt).getTime()) {
  throw new BadRequestException(this.i18n.t('auth.OTP_EXPIRED', { lang }));
}

    return true;
  }

  async verifyPasswordResetOtp(
    code: string,
    lang: string,
  ): Promise<PasswordResetOtpRecord> {
    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        code,
        userId: { not: null },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new BadRequestException(this.i18n.t('auth.OTP_NOT_FOUND', { lang }));
    }

    if (otpRecord.isUsed) {
      throw new BadRequestException(this.i18n.t('auth.OTP_ALREADY_USED', { lang }));
    }

    if (Date.now() > new Date(otpRecord.expiresAt).getTime()) {
      throw new BadRequestException(this.i18n.t('auth.OTP_EXPIRED', { lang }));
    }

    if (otpRecord.userId === null) {
      throw new BadRequestException(this.i18n.t('auth.OTP_NOT_FOUND', { lang }));
    }

    return {
      id: otpRecord.id,
      userId: otpRecord.userId,
      number: otpRecord.number,
      code: otpRecord.code,
      expiresAt: otpRecord.expiresAt,
    };
  }

  async markPasswordResetOtpAsUsed(
    otpId: number,
    userId: number,
    client: OtpWriteClient = this.prisma,
  ): Promise<boolean> {
    const result = await client.otp.updateMany({
      where: {
        id: otpId,
        userId,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      data: { isUsed: true },
    });

    return result.count === 1;
  }

//   async verifyRegistrationOtp(fullPhoneNumber: string, code: string, lang: string) {
//   const otpRecord = await this.prisma.otp.findFirst({
//     where: {
//       number: fullPhoneNumber,
//       code,
//       isUsed: false,
//       expiresAt: { gt: new Date() }, // ← فقط الصالح
//     },
//     orderBy: { createdAt: 'desc' }, // ← الأحدث
//   });

//   if (!otpRecord) {
//     // هون بتغطي حالتين: ما موجود + منتهي الصلاحية
//     throw new BadRequestException(this.i18n.t('auth.OTP_NOT_FOUND', { lang }));
//   }

//   // ما بقى محتاج تتحقق من isUsed و expiresAt بشكل منفصل
//   // لأنهم صاروا جزء من الـ query

//   return true;
// }

  async markOtpAsUsed(fullPhoneNumber: string, code: string) {
    await this.prisma.otp.updateMany({
      where: { number: fullPhoneNumber, code },
      data: { isUsed: true },
    });
  }
}
