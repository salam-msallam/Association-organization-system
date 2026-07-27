import { ForbiddenException, Injectable } from '@nestjs/common';
import { TransactionStatus, UserType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from 'src/prisma/prisma.service';
import { toPublicUploadUrl } from '../interceptors/upload-storage.util';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getMyProfile(userId: number, requestOrigin: string, lang = 'ar') {
    const user = await this.prisma.user.findUnique({
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

    if (!user) {
      throw new ForbiddenException(
        this.i18n.t('profile.PROFILE_NOT_AVAILABLE', { lang }),
      );
    }

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
        paymentStatus: TransactionStatus.SUCCESSFUL,
      },
    });

    return {
      fullName: `${user.firstName} ${user.lastName}`,
      gender: user.gender,
      walletBalance: Number(donor.wallet?.runningBalance ?? 0),
      isSponsor: donor.isSponsor,
      totalDonated: Number(donationAggregate._sum.amount ?? 0),
    };
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

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
