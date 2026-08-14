import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterNotificationDto } from './dto/register-notification.dto';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'accept-language',
  description:
    'Current app language used for future push notifications (ar or en)',
  required: false,
  schema: { default: 'ar', enum: ['ar', 'en'] },
})
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Put('registration')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Register or replace the Firebase registration ID for the authenticated user',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        message: 'Notification registration saved successfully.',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'The registration ID is invalid.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  register(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterNotificationDto,
    @I18nLang() lang = 'ar',
  ) {
    return this.notificationsService.register(
      req.user.id,
      dto.registrationId,
      lang,
    );
  }
}
