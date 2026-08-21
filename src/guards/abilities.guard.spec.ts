import { ForbiddenException } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { AbilitiesGuard } from './abilities.guard';

describe('AbilitiesGuard role-based admin authorization', () => {
  const reflector = {
    get: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const i18n = {
    t: jest.fn((key: string) => key),
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 1 },
        headers: { 'accept-language': 'en' },
      }),
    }),
    getHandler: () => jest.fn(),
  } as any;

  const guard = new AbilitiesGuard(
    reflector as any,
    new CaslAbilityFactory(),
    prisma as any,
    i18n as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.get.mockReturnValue({
      action: 'read',
      subject: 'Sponsorship',
    });
  });

  it('returns 403 for an admin without the required role permission', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      userType: UserType.ADMIN,
      roles: [],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows an admin whose role contains the required permission', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      userType: UserType.ADMIN,
      roles: [
        {
          role: {
            permissions: [{ permission: { name: 'read:sponsorships' } }],
          },
        },
      ],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
