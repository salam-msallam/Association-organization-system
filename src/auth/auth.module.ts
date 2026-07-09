import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { employeeJwtStrategy } from '../auth/dto/employee_jwt.strategy';
import { CacheModule } from '@nestjs/cache-manager';
import { OtpService } from './otp.service'; 
import { WhatsappService } from './whatsapp.service';
import { HttpModule } from '@nestjs/axios';
import { UsersService } from 'src/users/users.service';
import { ClientJwtStrategy } from './ClientJwtStrategy';

@Module({
  imports: [
    PrismaModule, 
    PassportModule,
    HttpModule,
    CacheModule.register({
      ttl: 600000, // 10 minutes
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }), // 3. تسجيل الباسبورت
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },   //   secret: 'SUPER_SECRET_KEY_123', 

    }),
  ],
  controllers: [
    AuthController, 
  ],
  providers: [
    AuthService,
    OtpService,
    WhatsappService,
    employeeJwtStrategy,
    ClientJwtStrategy,
    UsersService,
    JwtModule,
],
  exports: [
    AuthService,
     OtpService,WhatsappService,
     employeeJwtStrategy,
     ClientJwtStrategy,
     JwtModule,
    ], 
})
export class AuthModule {}
