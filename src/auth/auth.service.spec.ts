import { BadRequestException } from '@nestjs/common';
import { Gender, SocialStatus, Status, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

describe('AuthService', () => {
  let service: AuthService;
  let userCreate: jest.Mock;
  let donorCreate: jest.Mock;
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
    userCreate = jest.fn().mockResolvedValue({ id: 123 });
    donorCreate = jest.fn();
    beneficiaryCreate = jest.fn().mockResolvedValue({ id: 9 });

    prisma = {
      $transaction: jest.fn(async (callback) =>
        callback({
          user: {
            create: userCreate,
          },
          donor: {
            create: donorCreate,
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
      createRegistrationOtp: jest.fn().mockResolvedValue({
        code: '1234',
        fullPhoneNumber: '+971501234567',
        expiresAt: new Date(),
      }),
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

  it('normalizes donor registration before duplicate checks, cache, and OTP creation', async () => {
    await service.registerDonor(
      {
        firstName: 'Ali',
        lastName: 'Nasser',
        email: 'ali@example.com',
        password: 'password123',
        number: '0501234567',
        countryName: 'UAE',
        countryCode: '+971',
        gender: Gender.MALE,
        zipCode: '12345',
      },
      'en',
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        countryCode: '+971',
        number: '501234567',
      },
    });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'registration:+971501234567',
      expect.objectContaining({
        type: 'DONOR',
        data: expect.objectContaining({
          countryCode: '+971',
          number: '501234567',
          countryName: 'UAE',
        }),
      }),
    );
    expect(otpService.createRegistrationOtp).toHaveBeenCalledWith(
      '+971',
      '501234567',
    );
    expect(whatsappService.sendOtp).toHaveBeenCalledWith(
      '+971501234567',
      '1234',
      'en',
    );
  });

  it('rejects invalid donor registration phone before side effects', async () => {
    await expect(
      service.registerDonor(
        {
          firstName: 'Ali',
          lastName: 'Nasser',
          email: 'ali@example.com',
          password: 'password123',
          number: '121212122',
          countryName: 'UAE',
          countryCode: '+971',
          gender: Gender.MALE,
        },
        'en',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('auth.INVALID_PHONE_NUMBER', {
      lang: 'en',
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
    expect(otpService.createRegistrationOtp).not.toHaveBeenCalled();
  });

  it('normalizes client login before querying by phone components', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 7,
      firstName: 'Mona',
      lastName: 'Salem',
      countryCode: '+971',
      number: '501234567',
      password: hashedPassword,
      userType: UserType.DONOR,
      donor: { userId: 7 },
      beneficiary: null,
    });
    jwtService.signAsync.mockResolvedValueOnce('signed-token');

    const result = await service.login_client(
      { phoneNumber: '9710501234567', password: 'password123' },
      'en',
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        countryCode: '+971',
        number: '501234567',
      },
      include: {
        beneficiary: true,
        donor: true,
      },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 7,
      countryCode: '+971',
      number: '501234567',
      type: UserType.DONOR,
    });
    expect(result.access_token).toBe('signed-token');
  });

  it('rejects invalid client login phone before querying users', async () => {
    await expect(
      service.login_client(
        { phoneNumber: '+971121212122', password: 'password123' },
        'en',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('auth.INVALID_PHONE_NUMBER', {
      lang: 'en',
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('parses beneficiary address JSON before creating the beneficiary', async () => {
    await service.verifyRegistrationOtp(
      { countryCode: '+963', number: '0934206455', code: '1234' },
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
      '1234',
    );
    expect(cacheManager.del).toHaveBeenCalledWith('registration:+963934206455');
  });

  it('rejects invalid OTP verification phone before OTP lookup', async () => {
    await expect(
      service.verifyRegistrationOtp(
        { countryCode: '+971', number: '121212122', code: '1234' },
        'en',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(i18n.t).toHaveBeenCalledWith('auth.INVALID_PHONE_NUMBER', {
      lang: 'en',
    });
    expect(otpService.verifyRegistrationOtp).not.toHaveBeenCalled();
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('creates users from normalized pending registration data', async () => {
    cacheManager.get.mockResolvedValueOnce({
      type: 'BENEFICIARY',
      data: {
        ...pendingBeneficiaryData,
        countryCode: '+971',
        number: '501234567',
      },
      createdAt: new Date().toISOString(),
    });

    await service.verifyRegistrationOtp(
      { countryCode: '+971', number: '0501234567', code: '1234' },
      'en',
    );

    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryCode: '+971',
        number: '501234567',
      }),
    });
    expect(otpService.markOtpAsUsed).toHaveBeenCalledWith(
      '+971501234567',
      '1234',
    );
    expect(cacheManager.del).toHaveBeenCalledWith('registration:+971501234567');
  });

  it('allows accepted beneficiaries to login with normalized phone input', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 8,
      firstName: 'Sara',
      lastName: 'Hassan',
      countryCode: '+963',
      number: '934206455',
      password: hashedPassword,
      userType: UserType.BENEFICIARY,
      donor: null,
      beneficiary: { status: Status.ACCEPTED },
    });
    jwtService.signAsync.mockResolvedValueOnce('beneficiary-token');

    await service.login_client(
      { phoneNumber: '+9630934206455', password: 'password123' },
      'en',
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          countryCode: '+963',
          number: '934206455',
        },
      }),
    );
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
        { countryCode: '+963', number: '934206455', code: '1234' },
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
