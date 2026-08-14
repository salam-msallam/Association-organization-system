import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiTags,
  ApiOperation,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nContext, I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { createUploadStorage } from '../interceptors/upload-storage.util';
import { TranslationInterceptor } from '../interceptors/translation.interceptor';
import { ChangeProfilePasswordDto } from './dto/change-profile-password.dto';
import {
  BeneficiaryProfileResponseDto,
  DonorProfileResponseDto,
  EmployeeProfileResponseDto,
} from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

const translateProfileMessage = (key: string, fallback: string) =>
  I18nContext.current()?.t(`profile.${key}`) ?? fallback;

const DONOR_PROFILE_EXAMPLE = {
  fullName: 'Ahmad Ali',
  email: 'donor@example.com',
  countryCode: '+963',
  number: '934206455',
  gender: 'MALE',
  walletBalance: 150.5,
  isSponsor: true,
  totalDonated: 1250,
};

const PROFILE_RESPONSE_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(BeneficiaryProfileResponseDto) },
    { $ref: getSchemaPath(DonorProfileResponseDto) },
    { $ref: getSchemaPath(EmployeeProfileResponseDto) },
  ],
};

const PROFILE_RESPONSE_EXAMPLES = {
  donor: {
    summary: 'Donor profile',
    value: DONOR_PROFILE_EXAMPLE,
  },
};

@ApiTags('Profile')
@ApiExtraModels(
  BeneficiaryProfileResponseDto,
  DonorProfileResponseDto,
  EmployeeProfileResponseDto,
)
@ApiHeader({
  name: 'accept-language',
  description: 'اللغة المطلوبة للرد (ar أو en)',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@Controller('api/profile')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TranslationInterceptor)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Authenticated beneficiary, donor, or employee profile',
  })
  @ApiOkResponse({
    schema: PROFILE_RESPONSE_SCHEMA,
    content: {
      'application/json': {
        examples: PROFILE_RESPONSE_EXAMPLES,
      },
    },
  })
  getMyProfile(@Req() req: AuthenticatedRequest, @I18nLang() lang: string) {
    const requestOrigin = this.getRequestOrigin(req);

    return this.profileService.getMyProfile(req.user.id, requestOrigin, lang);
  }

  @Patch()
  @ApiBearerAuth('jwt')
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Update the authenticated beneficiary, donor, or employee profile',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({
    schema: PROFILE_RESPONSE_SCHEMA,
    content: {
      'application/json': {
        examples: PROFILE_RESPONSE_EXAMPLES,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid profile data, protected fields, or fields not allowed for the authenticated account type.',
  })
  @UseInterceptors(
    FileInterceptor('personalPhoto', {
      storage: createUploadStorage('./uploads/profile'),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException(
              translateProfileMessage(
                'PERSONAL_PHOTO_IMAGES_ONLY',
                'Only image uploads are allowed.',
              ),
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() personalPhoto: Express.Multer.File | undefined,
    @I18nLang() lang: string,
  ) {
    return this.profileService.updateMyProfile(
      req.user.id,
      updateProfileDto,
      this.getRequestOrigin(req),
      personalPhoto?.path,
      lang,
    );
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Change the authenticated user password' })
  @ApiBody({ type: ChangeProfilePasswordDto })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        message: 'Password updated successfully.',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid current password, weak new password, mismatched confirmation, or unchanged password.',
  })
  changeMyPassword(
    @Req() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangeProfilePasswordDto,
    @I18nLang() lang: string,
  ) {
    return this.profileService.changeMyPassword(
      req.user.id,
      changePasswordDto,
      lang,
    );
  }

  private getRequestOrigin(req: Request): string {
    return `${req.protocol}://${req.get('host')}`;
  }
}
