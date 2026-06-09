import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module'; 
import { CacheModule } from '@nestjs/cache-manager';
import { OtpService } from './otp.service'; 
import { WhatsappService } from './whatsapp.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    PrismaModule, 
    HttpModule,
    CacheModule.register({
      ttl: 600000, // 10 minutes
    }),
  ],
  controllers: [
    AuthController, 
  ],
  providers: [
    AuthService,
    OtpService,
    WhatsappService
],
  exports: [AuthService, OtpService,WhatsappService], 
})
export class AuthModule {}
