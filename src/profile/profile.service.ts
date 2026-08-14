import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  toPublicUploadPath,
  toPublicUploadUrl,
} from '../interceptors/upload-storage.util';
import { ChangeProfilePasswordDto } from './dto/change-profile-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const COMMON_PROFILE_FIELDS = new Set([
  'firstName',
  'lastName',
  'email',
  'gender',
]);

const EMPLOYEE_PROFILE_FIELDS = new Set([
  ...COMMON_PROFILE_FIELDS,
  'personalPhoto',
  'dateOfBirth',
]);

const BENEFICIARY_PROFILE_FIELDS = new Set([
  ...COMMON_PROFILE_FIELDS,
  'personalPhoto',
  'dateOfBirth',
  'address',
  'socialStatus',
  'isUnemployed',
]);

const PROTECTED_PROFILE_FIELDS = new Set([
  'id',
  'userId',
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'countryCode',
  'number',
  'phone',
  'phoneNumber',
  'mobile',
  'mobileNumber',
  'countryName',
  'roles',
  'roleIds',
  'userType',
  'type',
  'status',
  'statuses',
  'rejectionReason',
  'wallet',
  'walletBalance',
  'walletInformation',
  'walletTransactions',
  'runningBalance',
  'stripeCustomerId',
  'transactions',
  'isSponsor',
  'totalDonated',
  'monthlyIncome',
  'numberOfChildren',
  'familyStatement',
  'employee',
  'beneficiary',
  'donor',
  'otps',
  'createdAt',
  'updatedAt',
]);

const SUPPORTED_PROFILE_USER_TYPES: UserType[] = [
  UserType.EMPLOYEE,
  UserType.BENEFICIARY,
  UserType.DONOR,
];

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getMyProfile(userId: number, requestOrigin: string, lang = 'ar') {
    const user = await this.findProfileUser(userId);

    if (!user) {
      throw new ForbiddenException(
        this.i18n.t('profile.PROFILE_NOT_AVAILABLE', { lang }),
      );
    }

    return this.toPublicProfile(user, requestOrigin, lang);
  }

  async updateMyProfile(
    userId: number,
    dto: UpdateProfileDto,
    requestOrigin: string,
    personalPhotoPath?: string,
    lang = 'ar',
  ) {
    const user = await this.findProfileUser(userId);
    this.ensureProfileAvailable(user, lang);

    const protectedFields = this.getSubmittedProtectedFields(dto);
    if (protectedFields.length > 0) {
      throw new BadRequestException(
        this.i18n.t('profile.PROTECTED_FIELDS_NOT_ALLOWED', {
          lang,
          args: { fields: protectedFields.join(', ') },
        }),
      );
    }

    this.ensureFieldsAllowedForUserType(
      user.userType,
      dto,
      Boolean(personalPhotoPath),
      lang,
    );

    if (dto.personalPhoto !== undefined && !personalPhotoPath) {
      throw new BadRequestException(
        this.i18n.t('profile.PERSONAL_PHOTO_UPLOAD_REQUIRED', { lang }),
      );
    }

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new ConflictException(
          this.i18n.t('profile.EMAIL_ALREADY_USED', { lang }),
        );
      }
    }

    const updateData = this.buildProfileUpdateData(
      user.userType,
      dto,
      personalPhotoPath,
    );

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    return this.getMyProfile(userId, requestOrigin, lang);
  }

  async changeMyPassword(
    userId: number,
    dto: ChangeProfilePasswordDto,
    lang = 'ar',
  ) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        this.i18n.t('profile.PASSWORD_CONFIRMATION_MISMATCH', { lang }),
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new ForbiddenException(
        this.i18n.t('profile.PROFILE_NOT_AVAILABLE', { lang }),
      );
    }

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!currentPasswordMatches) {
      throw new UnauthorizedException(
        this.i18n.t('profile.CURRENT_PASSWORD_INVALID', { lang }),
      );
    }

    const newPasswordMatchesCurrent = await bcrypt.compare(
      dto.newPassword,
      user.password,
    );

    if (newPasswordMatchesCurrent) {
      throw new BadRequestException(
        this.i18n.t('profile.NEW_PASSWORD_MUST_BE_DIFFERENT', { lang }),
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: this.i18n.t('profile.PASSWORD_UPDATE_SUCCESS', { lang }),
    };
  }

  private findProfileUser(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        beneficiary: true,
        employee: true,
        donor: {
          include: {
            wallet: true,
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  private async toPublicProfile(
    user: NonNullable<Awaited<ReturnType<ProfileService['findProfileUser']>>>,
    requestOrigin: string,
    lang: string,
  ) {
    if (user.userType === UserType.EMPLOYEE && user.employee) {
      return {
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        countryCode: user.countryCode,
        number: user.number,
        gender: user.gender,
        userType: user.userType,
        personalPhoto: toPublicUploadUrl(
          user.employee.personalPhoto,
          requestOrigin,
        ),
        dateOfBirth: this.formatDateOnly(user.employee.dateOfBirth),
        roles: user.roles.map(({ role }) => ({
          id: role.id,
          name: role.name,
          label: role.label,
        })),
      };
    }

    if (user.userType === UserType.DONOR && user.donor) {
      return this.getDonorProfile(user, user.donor);
    }

    if (user.userType !== UserType.BENEFICIARY || !user.beneficiary) {
      throw new ForbiddenException(
        this.i18n.t('profile.PROFILE_NOT_AVAILABLE', { lang }),
      );
    }

    return {
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      countryCode: user.countryCode,
      age: this.calculateAge(user.beneficiary.dateOfBirth),
      socialStatus: user.beneficiary.socialStatus,
      address: user.beneficiary.address,
      number: user.number,
      gender: user.gender,
      isUnemployed: user.beneficiary.isUnemployed,
      personalPhoto: toPublicUploadUrl(
        user.beneficiary.personalPhoto,
        requestOrigin,
      ),
    };
  }

  private async getDonorProfile(
    user: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      countryCode: string;
      number: string;
      gender: string;
    },
    donor: {
      isSponsor: boolean;
      wallet: {
        runningBalance: { toString(): string };
      } | null;
    },
  ) {
    const donationAggregate = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        donorId: user.id,
        status: TransactionStatus.SUCCESSFUL,
      },
    });

    return {
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      countryCode: user.countryCode,
      number: user.number,
      gender: user.gender,
      walletBalance: Number(donor.wallet?.runningBalance ?? 0),
      isSponsor: donor.isSponsor,
      totalDonated: Number(donationAggregate._sum?.amount ?? 0),
    };
  }

  private ensureProfileAvailable(
    user: Awaited<ReturnType<ProfileService['findProfileUser']>>,
    lang: string,
  ): asserts user is NonNullable<
    Awaited<ReturnType<ProfileService['findProfileUser']>>
  > {
    if (
      !user ||
      (user.userType === UserType.EMPLOYEE && !user.employee) ||
      (user.userType === UserType.BENEFICIARY && !user.beneficiary) ||
      (user.userType === UserType.DONOR && !user.donor) ||
      !SUPPORTED_PROFILE_USER_TYPES.includes(user.userType)
    ) {
      throw new ForbiddenException(
        this.i18n.t('profile.PROFILE_NOT_AVAILABLE', { lang }),
      );
    }
  }

  private getSubmittedProtectedFields(dto: UpdateProfileDto): string[] {
    return Object.keys(dto).filter(
      (field) =>
        PROTECTED_PROFILE_FIELDS.has(field) &&
        dto[field as keyof UpdateProfileDto] !== undefined,
    );
  }

  private ensureFieldsAllowedForUserType(
    userType: UserType,
    dto: UpdateProfileDto,
    hasPersonalPhotoUpload: boolean,
    lang: string,
  ) {
    const submittedFields = new Set(
      Object.keys(dto).filter(
        (field) => dto[field as keyof UpdateProfileDto] !== undefined,
      ),
    );

    if (hasPersonalPhotoUpload) {
      submittedFields.add('personalPhoto');
    }

    const allowedFields =
      userType === UserType.EMPLOYEE
        ? EMPLOYEE_PROFILE_FIELDS
        : userType === UserType.BENEFICIARY
          ? BENEFICIARY_PROFILE_FIELDS
          : COMMON_PROFILE_FIELDS;

    const disallowedFields = [...submittedFields].filter(
      (field) => !allowedFields.has(field),
    );

    if (disallowedFields.length > 0) {
      throw new BadRequestException(
        this.i18n.t('profile.PROFILE_FIELDS_NOT_ALLOWED', {
          lang,
          args: { fields: disallowedFields.join(', ') },
        }),
      );
    }
  }

  private buildProfileUpdateData(
    userType: UserType,
    dto: UpdateProfileDto,
    personalPhotoPath?: string,
  ): Prisma.UserUpdateInput {
    const userData: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) userData.firstName = dto.firstName;
    if (dto.lastName !== undefined) userData.lastName = dto.lastName;
    if (dto.email !== undefined) userData.email = dto.email;
    if (dto.gender !== undefined) userData.gender = dto.gender;

    if (userType === UserType.EMPLOYEE) {
      const employeeData: Prisma.EmployeeUpdateWithoutUserInput = {};

      if (personalPhotoPath) {
        employeeData.personalPhoto = toPublicUploadPath(personalPhotoPath);
      }

      if (dto.dateOfBirth) {
        employeeData.dateOfBirth = new Date(dto.dateOfBirth);
      }

      if (Object.keys(employeeData).length > 0) {
        userData.employee = { update: employeeData };
      }
    }

    if (userType === UserType.BENEFICIARY) {
      const beneficiaryData: Prisma.BeneficiaryUpdateWithoutUserInput = {};

      if (personalPhotoPath) {
        beneficiaryData.personalPhoto = toPublicUploadPath(personalPhotoPath);
      }

      if (dto.dateOfBirth) {
        beneficiaryData.dateOfBirth = new Date(dto.dateOfBirth);
      }

      if (dto.address) {
        beneficiaryData.address = {
          ar: dto.address.ar,
          en: dto.address.en,
        };
      }

      if (dto.socialStatus !== undefined) {
        beneficiaryData.socialStatus = dto.socialStatus;
      }

      if (dto.isUnemployed !== undefined) {
        beneficiaryData.isUnemployed = dto.isUnemployed;
      }

      if (Object.keys(beneficiaryData).length > 0) {
        userData.beneficiary = { update: beneficiaryData };
      }
    }

    return userData;
  }

  private calculateAge(dateOfBirth: Date | null): number | null {
    if (!dateOfBirth) return null;

    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
    ) {
      age--;
    }

    return age;
  }

  private formatDateOnly(date: Date | null): string | null {
    return date ? date.toISOString().slice(0, 10) : null;
  }
}
