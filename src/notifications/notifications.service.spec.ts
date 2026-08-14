import { NotFoundException } from '@nestjs/common';
import type { I18nService } from 'nestjs-i18n';
import type { FirebaseService } from '../firebase/firebase.service';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

type UpdateManyMock = jest.MockedFunction<
  (args: unknown) => Promise<{ count: number }>
>;
type FindUserMock = jest.MockedFunction<
  (args: unknown) => Promise<{
    notificationRegistrationId: string | null;
    notificationLanguage?: string;
  } | null>
>;
type CreateNotificationMock = jest.MockedFunction<
  (args: unknown) => Promise<{ id: number }>
>;
type SendMock = jest.MockedFunction<(message: unknown) => Promise<string>>;

interface TransactionMock {
  user: {
    updateMany: UpdateManyMock;
    findUnique: FindUserMock;
  };
  notification: {
    create: CreateNotificationMock;
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let updateMany: UpdateManyMock;
  let findUser: FindUserMock;
  let createNotification: CreateNotificationMock;
  let clearRegistration: UpdateManyMock;
  let send: SendMock;

  beforeEach(() => {
    updateMany = jest.fn<(args: unknown) => Promise<{ count: number }>>();
    findUser = jest.fn<
      (args: unknown) => Promise<{
        notificationRegistrationId: string | null;
        notificationLanguage?: string;
      } | null>
    >();
    createNotification = jest.fn<(args: unknown) => Promise<{ id: number }>>();
    clearRegistration =
      jest.fn<(args: unknown) => Promise<{ count: number }>>();
    send = jest.fn<(message: unknown) => Promise<string>>();

    const tx: TransactionMock = {
      user: {
        updateMany,
        findUnique: findUser,
      },
      notification: {
        create: createNotification,
      },
    };

    const prisma = {
      $transaction: jest.fn(
        (callback: (client: TransactionMock) => Promise<unknown>) =>
          callback(tx),
      ),
      user: { updateMany: clearRegistration },
    } as unknown as PrismaService;
    const i18n = {
      t: jest.fn((key: string) => key),
    } as unknown as I18nService;
    const firebase = {
      messaging: { send },
    } as unknown as FirebaseService;

    service = new NotificationsService(prisma, i18n, firebase);
  });

  it('moves the registration ID from an old account to the current user', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      service.register(15, 'registration-id', 'en'),
    ).resolves.toEqual({
      success: true,
      message: 'notifications.REGISTRATION_SAVED',
    });

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        notificationRegistrationId: 'registration-id',
        id: { not: 15 },
      },
      data: { notificationRegistrationId: null },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 15 },
      data: {
        notificationRegistrationId: 'registration-id',
        notificationLanguage: 'en',
      },
    });
  });

  it('throws when the authenticated user no longer exists', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      service.register(999, 'registration-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores the notification without sending when the user has no registration ID', async () => {
    findUser.mockResolvedValue({ notificationRegistrationId: null });
    createNotification.mockResolvedValue({ id: 30 });

    await expect(
      service.createAndSend({
        userId: 15,
        title: { ar: 'عنوان', en: 'Title' },
        message: { ar: 'رسالة', en: 'Message' },
        targetType: 'REQUEST_AID',
        targetId: 20,
      }),
    ).resolves.toEqual({ notificationId: 30, pushSent: false });

    expect(send).not.toHaveBeenCalled();
  });

  it('stores and sends a notification to the registered Firebase installation', async () => {
    findUser.mockResolvedValue({ notificationRegistrationId: 'fid-123' });
    createNotification.mockResolvedValue({ id: 31 });
    send.mockResolvedValue('firebase-message-id');

    await expect(
      service.createAndSend({
        userId: 15,
        title: { ar: 'تم القبول', en: 'Accepted' },
        message: { ar: 'تم قبول طلبك', en: 'Your request was accepted' },
        targetType: 'REQUEST_AID',
        targetId: 20,
      }),
    ).resolves.toEqual({ notificationId: 31, pushSent: true });

    expect(send).toHaveBeenCalledWith({
      fid: 'fid-123',
      notification: {
        title: 'تم القبول',
        body: 'تم قبول طلبك',
      },
      data: {
        notificationId: '31',
        titleAr: 'تم القبول',
        titleEn: 'Accepted',
        messageAr: 'تم قبول طلبك',
        messageEn: 'Your request was accepted',
        targetType: 'REQUEST_AID',
        targetId: '20',
      },
    });
  });

  it('keeps the notification and clears an expired Firebase registration', async () => {
    findUser.mockResolvedValue({ notificationRegistrationId: 'expired-fid' });
    createNotification.mockResolvedValue({ id: 32 });
    send.mockRejectedValue({
      code: 'messaging/installation-id-not-registered',
    });
    clearRegistration.mockResolvedValue({ count: 1 });

    await expect(
      service.createAndSend({
        userId: 15,
        title: { ar: 'عنوان', en: 'Title' },
        message: { ar: 'رسالة', en: 'Message' },
      }),
    ).resolves.toEqual({ notificationId: 32, pushSent: false });

    expect(clearRegistration).toHaveBeenCalledWith({
      where: {
        id: 15,
        notificationRegistrationId: 'expired-fid',
      },
      data: { notificationRegistrationId: null },
    });
  });

  it('uses the stored user language for the visible push text', async () => {
    findUser.mockResolvedValue({
      notificationRegistrationId: 'fid-english',
      notificationLanguage: 'en-US',
    });
    createNotification.mockResolvedValue({ id: 33 });
    send.mockResolvedValue('firebase-message-id');

    await service.createAndSend({
      userId: 15,
      title: { ar: 'Arabic title', en: 'English title' },
      message: { ar: 'Arabic message', en: 'English message' },
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: {
          title: 'English title',
          body: 'English message',
        },
      }),
    );
  });
});
