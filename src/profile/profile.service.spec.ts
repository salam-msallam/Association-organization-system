import {
  Gender,
  SocialStatus,
  TransactionStatus,
  UserType,
} from '@prisma/client';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: any;
  let i18n: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-23T12:00:00.000Z'));

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          firstName: 'Salam',
          lastName: 'Msallam',
          number: '934206455',
          gender: Gender.MALE,
          userType: UserType.BENEFICIARY,
          employee: null,
          donor: null,
          roles: [],
          beneficiary: {
            dateOfBirth: new Date('1990-07-24'),
            socialStatus: SocialStatus.SINGLE,
            address: { ar: 'دمشق', en: 'Damascus' },
            isUnemployed: true,
            personalPhoto: 'uploads/beneficiaries/photo.jpg',
          },
        }),
      },
      transaction: {
        aggregate: jest.fn(),
      },
      sponsorship: {
        findFirst: jest.fn(),
      },
    };

    i18n = {
      t: jest.fn((key: string, { lang }: { lang: string }) =>
        lang === 'en' ? `English: ${key}` : `Arabic: ${key}`,
      ),
    };

    service = new ProfileService(prisma, i18n);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the existing beneficiary profile response', async () => {
    const profile = await service.getMyProfile(
      1,
      'https://charity.example.com',
    );

    expect(profile).toEqual({
      fullName: 'Salam Msallam',
      age: 35,
      socialStatus: SocialStatus.SINGLE,
      address: { ar: 'دمشق', en: 'Damascus' },
      number: '934206455',
      gender: Gender.MALE,
      isUnemployed: true,
      personalPhoto:
        'https://charity.example.com/uploads/beneficiaries/photo.jpg',
    });
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
    expect(prisma.sponsorship.findFirst).not.toHaveBeenCalled();
  });

  it('returns wallet balance, successful donations, and the stored sponsor flag for a donor', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 7,
      firstName: 'Ahmad',
      lastName: 'Ali',
      gender: Gender.MALE,
      userType: UserType.DONOR,
      employee: null,
      beneficiary: null,
      roles: [],
      donor: {
        isSponsor: true,
        wallet: {
          runningBalance: { toString: () => '150.50' },
        },
      },
    });
    prisma.transaction.aggregate.mockResolvedValueOnce({
      _sum: {
        amount: { toString: () => '1250.00' },
      },
    });

    const profile = await service.getMyProfile(
      7,
      'https://charity.example.com',
    );

    expect(profile).toEqual({
      fullName: 'Ahmad Ali',
      gender: Gender.MALE,
      walletBalance: 150.5,
      isSponsor: true,
      totalDonated: 1250,
    });
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      _sum: { amount: true },
      where: {
        donorId: 7,
        status: TransactionStatus.SUCCESSFUL,
      },
    });
    expect(prisma.sponsorship.findFirst).not.toHaveBeenCalled();
  });

  it('returns zero balances and a false stored sponsor flag', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 8,
      firstName: 'Mona',
      lastName: 'Salem',
      gender: Gender.FEMALE,
      userType: UserType.DONOR,
      employee: null,
      beneficiary: null,
      roles: [],
      donor: {
        isSponsor: false,
        wallet: null,
      },
    });
    prisma.transaction.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });

    const profile = await service.getMyProfile(
      8,
      'https://charity.example.com',
    );

    expect(profile).toEqual({
      fullName: 'Mona Salem',
      gender: Gender.FEMALE,
      walletBalance: 0,
      isSponsor: false,
      totalDonated: 0,
    });
  });

  it('returns the employee profile and roles without a security log or password', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 12,
      firstName: 'Ahmad',
      lastName: 'Ali',
      email: 'ahmad@example.com',
      password: 'must-not-be-returned',
      countryCode: '+963',
      number: '934206455',
      gender: Gender.MALE,
      userType: UserType.EMPLOYEE,
      employee: {
        id: 4,
        personalPhoto: 'uploads/employees/photo.jpg',
        dateOfBirth: new Date('1994-04-18'),
        createdAt: new Date('2026-01-01'),
      },
      beneficiary: null,
      donor: null,
      roles: [
        {
          role: {
            id: 2,
            name: 'employee_manager',
            label: { ar: 'مدير الموظفين', en: 'Employee manager' },
          },
        },
      ],
    });

    const profile = await service.getMyProfile(
      12,
      'https://charity.example.com',
      'en',
    );

    expect(profile).toEqual({
      id: 12,
      fullName: 'Ahmad Ali',
      firstName: 'Ahmad',
      lastName: 'Ali',
      email: 'ahmad@example.com',
      countryCode: '+963',
      number: '934206455',
      gender: Gender.MALE,
      userType: UserType.EMPLOYEE,
      personalPhoto: 'https://charity.example.com/uploads/employees/photo.jpg',
      dateOfBirth: '1994-04-18',
      roles: [
        {
          id: 2,
          name: 'employee_manager',
          label: { ar: 'مدير الموظفين', en: 'Employee manager' },
        },
      ],
    });
    expect(profile).not.toHaveProperty('password');
    expect(profile).not.toHaveProperty('securityLog');
    expect(profile).not.toHaveProperty('securityLogs');
  });

  it('localizes the unavailable-profile error in English', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.getMyProfile(99, 'https://charity.example.com', 'en'),
    ).rejects.toThrow('English: profile.PROFILE_NOT_AVAILABLE');
    expect(i18n.t).toHaveBeenCalledWith('profile.PROFILE_NOT_AVAILABLE', {
      lang: 'en',
    });
  });
});
