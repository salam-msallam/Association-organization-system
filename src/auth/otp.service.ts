import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class OtpService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly i18n: I18nService
    ) {}

    async createRegistrationOtp(
      countryCode: string,
      number: string,
    ): Promise<{ code: string; fullPhoneNumber: string; expiresAt: Date }> {
    // 1. Normalize the phone number format
    const cleanCountry = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    const fullPhoneNumber = `${cleanCountry}${number}`;

    // 2. Set expiration time to 10 minutes from now
    //const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  console.log('Server now:', now.toISOString());
  console.log('Expires at:', expiresAt.toISOString());

    // 3. Generate a 4-digit numeric code string
    const code = Math.floor(1000 + Math.random() * 9000).toString();


    // 4. Clean up / Invalidate previous unused OTPs for this number
    // We assume your table has an 'isUsed' or similar flag, or we simply invalidate them by expiring them out.
    // If your schema has an 'isUsed' boolean field, you can do:
    await this.prisma.otp.updateMany({
      where: {
    number: fullPhoneNumber,
    userId: null,
    expiresAt: { gt: new Date() }, // تحديث فقط الرموز التي لم تنتهِ صلاحيتها بعد
    isUsed: false, 
  },
  data: {
    expiresAt: new Date(), // جعلها تنتهي الآن
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
    console.log('Expires at:', expiresAt.toISOString());

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
      isUsed: false // يفضل فلترتها هنا مباشرة إن وجدت في الـ Schema
    },
    orderBy: {
      createdAt: 'desc', 
    },
  });
  console.log('Checking at:', new Date().toISOString());
console.log('OTP expires:', otpRecord?.expiresAt?.toISOString());

    if (!otpRecord) {
      throw new BadRequestException(this.i18n.t('auth.OTP_NOT_FOUND', { lang }));
    }

    if (otpRecord.isUsed) {
      throw new BadRequestException(this.i18n.t('auth.OTP_ALREADY_USED', { lang }));
    }

   // تحويل كلا الوقتين إلى الـ Timestamp الرقمي الموحد لإلغاء تأثير الـ Timezone تماماً
if (Date.now() > new Date(otpRecord.expiresAt).getTime()) {
  throw new BadRequestException(this.i18n.t('auth.OTP_EXPIRED', { lang }));
}

    return true;
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
