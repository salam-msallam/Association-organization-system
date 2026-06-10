import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module'; 
import { CacheModule } from '@nestjs/cache-manager';
import { OtpService } from './otp.service'; 
import { WhatsappService } from './whatsapp.service';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './JwtStrategy';
import { UsersService } from 'src/users/users.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule, 
    HttpModule,
    CacheModule.register({
      ttl: 600000, // 10 minutes
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }), // 3. تسجيل الباسبورت
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [
    AuthController, 
  ],
  providers: [
    AuthService,
    OtpService,
    WhatsappService,
    JwtStrategy,
    UsersService,
    JwtModule,
],
  exports: [
    AuthService,
     OtpService,WhatsappService,
     JwtStrategy,
     JwtModule,
    ], 
})
export class AuthModule {}
