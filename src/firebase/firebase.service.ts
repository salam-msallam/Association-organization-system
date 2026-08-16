import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  App,
  cert,
  getApp,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { existsSync, readFileSync } from 'node:fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private appInstance?: App;
  private messagingInstance?: Messaging;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const existingApp = getApps().length > 0 ? getApp() : undefined;

    this.appInstance = existingApp ?? this.initializeFirebaseApp();
    this.messagingInstance = getMessaging(this.appInstance);

    this.logger.log('Firebase Admin initialized successfully');
  }

  get app(): App {
    if (!this.appInstance) {
      throw new Error('Firebase Admin has not been initialized');
    }

    return this.appInstance;
  }

  get messaging(): Messaging {
    if (!this.messagingInstance) {
      throw new Error('Firebase Messaging has not been initialized');
    }

    return this.messagingInstance;
  }

  private initializeFirebaseApp(): App {
    const serviceAccountPath = this.configService
      .get<string>('FIREBASE_SERVICE_ACCOUNT_PATH')
      ?.trim();

    if (!serviceAccountPath) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_PATH environment variable is required',
      );
    }

    if (!existsSync(serviceAccountPath)) {
      throw new Error('Firebase service account file was not found');
    }

    let serviceAccount: ServiceAccount;

    try {
      const fileContent = readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(fileContent) as ServiceAccount;
    } catch {
      throw new Error('Firebase service account file is not valid JSON');
    }

    try {
      return initializeApp({ credential: cert(serviceAccount) });
    } catch {
      throw new Error('Firebase service account credentials are invalid');
    }
  }
}
