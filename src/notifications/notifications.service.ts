import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, UserType } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeNotificationLanguage,
  type NotificationLanguage,
} from './notification-language.util';

export interface BilingualNotificationText {
  ar: string;
  en: string;
}

export interface CreateNotificationInput {
  userId: number;
  title: BilingualNotificationText;
  message: BilingualNotificationText;
  targetType?: string;
  targetId?: number;
  additionalData?: Record<string, string>;
}

export interface CreateNotificationResult {
  notificationId: number;
  pushSent: boolean;
}

export interface SendNotificationToPermissionResult {
  recipientCount: number;
  notificationCount: number;
  pushSentCount: number;
}

export interface SendNotificationToPermissionOptions {
  excludeNotifiedSince?: Date;
}

export interface FindNotificationsOptions {
  page: number;
  limit: number;
  isRead?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly firebase: FirebaseService,
  ) {}

  async register(
    userId: number,
    registrationId: string,
    lang = 'ar',
  ): Promise<{ success: true; message: string }> {
    const notificationLanguage = normalizeNotificationLanguage(lang);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: {
          notificationRegistrationId: registrationId,
          id: { not: userId },
        },
        data: { notificationRegistrationId: null },
      });

      const result = await tx.user.updateMany({
        where: { id: userId },
        data: {
          notificationRegistrationId: registrationId,
          notificationLanguage,
        },
      });

      if (result.count === 0) {
        throw new NotFoundException(
          this.i18n.t('notifications.USER_NOT_FOUND', { lang }),
        );
      }
    });

    return {
      success: true,
      message: this.i18n.t('notifications.REGISTRATION_SAVED', { lang }),
    };
  }

  async findMine(userId: number, options: FindNotificationsOptions) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(options.isRead === undefined ? {} : { isRead: options.isRead }),
    };
    const skip = (options.page - 1) * options.limit;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          title: true,
          message: true,
          targetType: true,
          targetId: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: options.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    const totalPages = Math.ceil(totalCount / options.limit);

    return {
      data: notifications,
      meta: {
        totalCount,
        page: options.page,
        limit: options.limit,
        totalPages,
        hasNextPage: options.page < totalPages,
        hasPreviousPage: options.page > 1,
      },
      unreadCount,
    };
  }

  async getUnreadCount(userId: number): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { unreadCount };
  }

  async markAsRead(
    userId: number,
    notificationId: number,
    lang = 'ar',
  ): Promise<{ id: number; isRead: true }> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        this.i18n.t('notifications.NOT_FOUND', { lang }),
      );
    }

    return { id: notificationId, isRead: true };
  }

  async markAllAsRead(
    userId: number,
  ): Promise<{ success: true; updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { success: true, updatedCount: result.count };
  }

  async createAndSend(
    input: CreateNotificationInput,
    lang = 'ar',
  ): Promise<CreateNotificationResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: {
          notificationRegistrationId: true,
          notificationLanguage: true,
        },
      });

      if (!user) {
        throw new NotFoundException(
          this.i18n.t('notifications.USER_NOT_FOUND', { lang }),
        );
      }

      const notification = await tx.notification.create({
        data: {
          userId: input.userId,
          title: { ar: input.title.ar, en: input.title.en },
          message: { ar: input.message.ar, en: input.message.en },
          targetType: input.targetType,
          targetId: input.targetId,
        },
        select: { id: true },
      });

      return {
        notificationId: notification.id,
        registrationId: user.notificationRegistrationId,
        notificationLanguage: normalizeNotificationLanguage(
          user.notificationLanguage,
        ),
      };
    });

    if (!result.registrationId) {
      return { notificationId: result.notificationId, pushSent: false };
    }

    const pushLanguage: NotificationLanguage = result.notificationLanguage;

    try {
      await this.firebase.messaging.send({
        token: result.registrationId,
        notification: {
          title: input.title[pushLanguage],
          body: input.message[pushLanguage],
        },
        data: {
          ...input.additionalData,
          notificationId: String(result.notificationId),
          titleAr: input.title.ar,
          titleEn: input.title.en,
          messageAr: input.message.ar,
          messageEn: input.message.en,
          ...(input.targetType ? { targetType: input.targetType } : {}),
          ...(input.targetId !== undefined
            ? { targetId: String(input.targetId) }
            : {}),
        },
      });

      return { notificationId: result.notificationId, pushSent: true };
    } catch (error: unknown) {
      const errorCode = this.getFirebaseErrorCode(error);
      this.logger.warn(
        `Firebase push delivery failed${errorCode ? ` (${errorCode})` : ''}`,
      );

      if (this.isInvalidRegistrationError(errorCode)) {
        await this.clearInvalidRegistration(
          input.userId,
          result.registrationId,
        );
      }

      return { notificationId: result.notificationId, pushSent: false };
    }
  }

  async createAndSendToPermission(
    permissionName: string,
    input: Omit<CreateNotificationInput, 'userId'>,
    lang = 'ar',
    options: SendNotificationToPermissionOptions = {},
  ): Promise<SendNotificationToPermissionResult> {
    const excludePreviouslyNotified =
      options.excludeNotifiedSince &&
      input.targetType &&
      input.targetId !== undefined
        ? {
            notifications: {
              none: {
                targetType: input.targetType,
                targetId: input.targetId,
                createdAt: { gte: options.excludeNotifiedSince },
              },
            },
          }
        : {};

    const recipients = await this.prisma.user.findMany({
      where: {
        userType: UserType.EMPLOYEE,
        roles: {
          some: {
            role: {
              permissions: {
                some: {
                  permission: { name: permissionName },
                },
              },
            },
          },
        },
        ...excludePreviouslyNotified,
      },
      select: { id: true },
    });

    const results = await Promise.allSettled(
      recipients.map(({ id }) =>
        this.createAndSend(
          {
            ...input,
            userId: id,
          },
          lang,
        ),
      ),
    );
    const successfulResults = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failedCount = results.length - successfulResults.length;

    if (failedCount > 0) {
      this.logger.warn(
        `Failed to create ${failedCount} notification(s) for permission ${permissionName}`,
      );
    }

    return {
      recipientCount: recipients.length,
      notificationCount: successfulResults.length,
      pushSentCount: successfulResults.filter(({ pushSent }) => pushSent)
        .length,
    };
  }

  private getFirebaseErrorCode(error: unknown): string | undefined {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      return error.code;
    }

    return undefined;
  }

  private isInvalidRegistrationError(errorCode?: string): boolean {
    return (
      errorCode === 'messaging/installation-id-not-registered' ||
      errorCode === 'messaging/registration-token-not-registered' ||
      errorCode === 'messaging/invalid-registration-token'
    );
  }

  private async clearInvalidRegistration(
    userId: number,
    registrationId: string,
  ): Promise<void> {
    try {
      await this.prisma.user.updateMany({
        where: {
          id: userId,
          notificationRegistrationId: registrationId,
        },
        data: { notificationRegistrationId: null },
      });
    } catch {
      this.logger.error('Failed to clear an invalid Firebase registration');
    }
  }
}
