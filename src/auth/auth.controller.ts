import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { RegisterBeneficiaryDto } from './dto/register-beneficiary.dto';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {LoginClientDto} from './dto/login_client.dto';
// @ApiTags('Authentication') 
import {
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';


@ApiTags('Auth')
@ApiHeader({
  name: 'accept-language',
  description: 'Language preferred for the response error/success messages',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },  
})
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK) 
  @ApiOperation({ summary: 'تسجيل دخول الأدمن والموظفين' })
  @ApiResponse({ status: 200, description: 'تم تسجيل الدخول بنجاح وعاد التوكن.' })
  @ApiResponse({ status: 401, description: 'البيانات المدخلة خاطئة.' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto);
    return this.authService.login(user);
  }


  @Post('register/donor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new donor account' })
  @ApiResponse({ status: 201, description: 'OTP was sent to the donor phone number.' })
  @ApiResponse({ status: 400, description: 'Invalid request body.' })
  async registerDonor(
    @Body() registerDonorDto: RegisterDonorDto,
    @I18nLang() lang: string,
  ) {
    return this.authService.registerDonor(registerDonorDto, lang);
  }

  @Post('register/beneficiary')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'personalPhoto', maxCount: 1 },
        { name: 'familyStatement', maxCount: 1 },
      ],
      { dest: './uploads/beneficiaries' },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RegisterBeneficiaryDto })
  @ApiOperation({ summary: 'Register a new beneficiary account request' })
  @ApiResponse({ status: 201, description: 'OTP was sent to the beneficiary phone number.' })
  @ApiResponse({ status: 400, description: 'Invalid request body.' })
  async registerBeneficiary(

    @Body() registerBeneficiaryDto: RegisterBeneficiaryDto,

    @UploadedFiles()

    files: {

      personalPhoto?: Array<{ path: string }>;

      familyStatement?: Array<{ path: string }>;

    },

    @I18nLang() lang: string,

  ) {

    const personalPhoto = files?.personalPhoto?.[0]?.path;
    const familyStatement = files?.familyStatement?.[0]?.path;

    if (!personalPhoto || !familyStatement) {
      throw new BadRequestException('personalPhoto and familyStatement files are required');

    }

    registerBeneficiaryDto.personalPhoto = personalPhoto;
    registerBeneficiaryDto.familyStatement = familyStatement;

    return this.authService.registerBeneficiary(registerBeneficiaryDto, lang);

  } 


  @Post('register/verify-otp')
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @I18nLang() lang: string,
  ) {
    return this.authService.verifyRegistrationOtp(verifyOtpDto, lang);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login/client')
  async login_client(@Body() loginClientDto: LoginClientDto,
         @I18nLang() lang:string) {
    return this.authService.login_client(loginClientDto, lang);
  }
}
