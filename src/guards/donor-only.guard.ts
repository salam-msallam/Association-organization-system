import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: number;
  };
}

@Injectable()
export class DonorOnlyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const lang = String(request.headers['accept-language'] ?? 'ar');
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        lang.startsWith('ar')
          ? 'المصادقة مطلوبة'
          : 'Authentication is required',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true, donor: { select: { id: true } } },
    });

    if (!user) {
      throw new UnauthorizedException(
        lang.startsWith('ar') ? 'المستخدم غير موجود' : 'User was not found',
      );
    }

    if (user.userType !== UserType.DONOR || !user.donor) {
      throw new ForbiddenException(
        lang.startsWith('ar')
          ? 'حاسبة الزكاة متاحة للمتبرعين فقط'
          : 'The zakat calculator is available to donors only',
      );
    }

    return true;
  }
}
