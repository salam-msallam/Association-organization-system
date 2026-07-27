import {
  Controller,
  Get,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiTags,
  ApiOperation,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { TranslationInterceptor } from '../interceptors/translation.interceptor';
import {
  BeneficiaryProfileResponseDto,
  DonorProfileResponseDto,
  EmployeeProfileResponseDto,
} from './dto/profile-response.dto';
import { ProfileService } from './profile.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

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
    schema: {
      oneOf: [
        { $ref: getSchemaPath(BeneficiaryProfileResponseDto) },
        { $ref: getSchemaPath(DonorProfileResponseDto) },
        { $ref: getSchemaPath(EmployeeProfileResponseDto) },
      ],
    },
  })
  getMyProfile(@Req() req: AuthenticatedRequest, @I18nLang() lang: string) {
    const requestOrigin = `${req.protocol}://${req.get('host')}`;

    return this.profileService.getMyProfile(req.user.id, requestOrigin, lang);
  }
}
