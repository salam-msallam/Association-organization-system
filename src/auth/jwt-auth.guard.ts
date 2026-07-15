import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly i18n: I18nService) {
    super();
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    context: ExecutionContext,
  ): TUser {
    if (err) throw err;
    if (!user) {
      const request = context.switchToHttp().getRequest();
      const lang = request.headers['accept-language'] || 'ar';
      throw new UnauthorizedException(
        this.i18n.t('auth.LOGIN_REQUIRED', { lang }),
      );
    }

    return user as TUser;
  }
}
