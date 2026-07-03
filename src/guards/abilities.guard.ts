import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../casl/casl-ability.factory'; 
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
    private prisma: PrismaService, 
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const lang = request.headers['accept-language'] || 'ar';

    
    const userPayload = request.user; 
    if (!userPayload) {
      throw new UnauthorizedException(this.i18n.t('auth.LOGIN_REQUIRED', { lang }));
    }

    const requiredAbility = this.reflector.get<{ action: string; subject: string }>('check_ability', context.getHandler());
    if (!requiredAbility) return true;

    const fullUser = await this.prisma.user.findUnique({
      where: { id: userPayload.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });


    if (!fullUser) {
      throw new UnauthorizedException(this.i18n.t('auth.USER_NOT_FOUND', { lang }));
    }

    const userPermissions: string[] = [];

    if (fullUser.roles) {
      fullUser.roles.forEach(userRole => {
        userRole.role.permissions.forEach(p => {
          userPermissions.push(p.permission.name);
        });
      });
    }

    const currentUserForCasl = {
      id: fullUser.id,
      userType: fullUser.userType,
      permissions: userPermissions,
    };

    const ability = this.caslAbilityFactory.createForUser(currentUserForCasl);

    const isAllowed = ability.can(requiredAbility.action as any, requiredAbility.subject as any);

    if (!isAllowed) {
      throw new ForbiddenException(this.i18n.t('auth.INSUFFICIENT_PERMISSIONS', { lang }));
    }

    return true;
  }
}
