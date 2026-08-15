import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterNotificationDto } from './dto/register-notification.dto';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';
import {
  MarkAllNotificationsReadResponseDto,
  MarkNotificationReadResponseDto,
  NotificationListResponseDto,
  NotificationUnreadCountResponseDto,
} from './dto/notification-response.dto';
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

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notificationsService.findMine(req.user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get the unread notification count for the authenticated user',
  })
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications of the authenticated user as read',
  })
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark one notification of the authenticated user as read',
  })
  @ApiOkResponse({ type: MarkNotificationReadResponseDto })
  @ApiNotFoundResponse({ description: 'The notification was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @I18nLang() lang = 'ar',
  ) {
    return this.notificationsService.markAsRead(req.user.id, id, lang);
  }

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
