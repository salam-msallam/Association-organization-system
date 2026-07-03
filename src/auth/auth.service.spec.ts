import { BadRequestException } from '@nestjs/common';
import { Gender, SocialStatus } from '@prisma/client';
import { AuthService } from './auth.service';

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

describe('AuthService', () => {
  let service: AuthService;
  let beneficiaryCreate: jest.Mock;
  let prisma: any;
  let cacheManager: any;
  let otpService: any;
  let whatsappService: any;
  let i18n: any;
  let usersService: any;
  let jwtService: any;

  const pendingBeneficiaryData = {
    firstName: 'Salam',
    lastName: 'Msallam',
    email: 'salam@example.com',
    password: 'password123',
    number: '934206455',
    countryName: 'syria',
    countryCode: '+963',
    gender: Gender.MALE,
    personalPhoto: 'uploads/beneficiaries/photo.jpg',
    familyStatement: 'uploads/beneficiaries/family.jpg',
    address: '{"city":"Mezzeh","street":"Main"}',
    socialStatus: SocialStatus.WIDOWED,
    isUnemployed: true,
    numberOfChildren: 3,
  };

  beforeEach(() => {
    beneficiaryCreate = jest.fn().mockResolvedValue({ id: 9 });

    prisma = {
      $transaction: jest.fn(async (callback) =>
        callback({
          user: {
            create: jest.fn().mockResolvedValue({ id: 123 }),
          },
          donor: {
            create: jest.fn(),
          },
          beneficiary: {
            create: beneficiaryCreate,
          },
        }),
      ),
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    cacheManager = {
      get: jest.fn().mockResolvedValue({
        type: 'BENEFICIARY',
        data: pendingBeneficiaryData,
        createdAt: new Date().toISOString(),
      }),
      set: jest.fn(),
      del: jest.fn(),
    };

    otpService = {
      verifyRegistrationOtp: jest.fn().mockResolvedValue(undefined),
      markOtpAsUsed: jest.fn().mockResolvedValue(undefined),
    };

    whatsappService = {
      sendOtp: jest.fn(),
    };

    i18n = {
      t: jest.fn((key, options) => {
        const field = options?.args?.field;
        return field ? `${key}:${field}` : key;
      }),
    };

    usersService = {};
    jwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
    };

    service = new AuthService(
      cacheManager,
      prisma,
      otpService,
      whatsappService,
      i18n,
      usersService,
      jwtService,
    );
  });

  it('parses beneficiary address JSON before creating the beneficiary', async () => {
    await service.verifyRegistrationOtp(
      { countryCode: '+963', number: '934206455', code: '123456' },
      'en',
    );

    expect(beneficiaryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 123,
        address: {
          city: 'Mezzeh',
          street: 'Main',
        },
      }),
    });
    expect(otpService.markOtpAsUsed).toHaveBeenCalledWith(
      '+963934206455',
      '123456',
    );
    expect(cacheManager.del).toHaveBeenCalledWith('registration:+963934206455');
  });

  it('throws BadRequestException when beneficiary address is invalid JSON', async () => {
    cacheManager.get.mockResolvedValueOnce({
      type: 'BENEFICIARY',
      data: {
        ...pendingBeneficiaryData,
        address: 'Mezzeh',
      },
      createdAt: new Date().toISOString(),
    });

    await expect(
      service.verifyRegistrationOtp(
        { countryCode: '+963', number: '934206455', code: '123456' },
        'en',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('auth.INVALID_JSON_FIELD', {
      lang: 'en',
      args: { field: 'address' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
