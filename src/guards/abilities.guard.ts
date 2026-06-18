import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../casl/casl-ability.factory'; 
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
    private prisma: PrismaService, 
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    console.log('--- فحص الطلب في الـ Guard ---');
    console.log('المستخدم القادم من التوكن:', request.user);
    
    const userPayload = request.user; 
    if (!userPayload) {
      console.log('❌ فشل الحارس: لم يتم العثور على user داخل الـ request');
      throw new UnauthorizedException('يرجى تسجيل الدخول أولاً');
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

    console.log('المستخدم الكامل من الـ DB:', fullUser);

    if (!fullUser) {
      throw new UnauthorizedException('المستخدم غير موجود في النظام');
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
      throw new ForbiddenException('ليس لديك الصلاحية الكافية لإجراء هذه العملية');
    }

    return true;
  }
}