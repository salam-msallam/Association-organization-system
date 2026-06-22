import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffOnlyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userPayload = request.user;
    const lang = I18nContext.current(context)?.lang || 'ar';

    if (!userPayload?.id) {
      throw new UnauthorizedException(this.i18n.t('auth.LOGIN_REQUIRED', { lang }));
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userPayload.id },
      select: { id: true, userType: true },
    });

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.USER_NOT_FOUND', { lang }));
    }

    if (user.userType !== UserType.EMPLOYEE && user.userType !== UserType.ADMIN) {
      throw new ForbiddenException(this.i18n.t('auth.STAFF_ONLY_CONTROL_PANEL', { lang }));
    }

    return true;
  }
}
