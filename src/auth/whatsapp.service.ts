import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { I18nService } from 'nestjs-i18n';
import { firstValueFrom } from 'rxjs';

interface UltraMsgResponse {
  sent?: string;
  id?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly i18n: I18nService,
  ) {}
  async sendOtp(fullPhoneNumber: string, code: string, lang: string): Promise<void> {
    const instanceId = this.configService.get<string>('ULTRAMSG_INSTANCE_ID');
    const token = this.configService.get<string>('ULTRAMSG_TOKEN');
    const expiresMinutes = this.configService.get<number>('OTP_EXPIRES_MINUTES', 10);

    // 1. Translate the message body using nestjs-i18n
    const messageBody = this.i18n.t('auth.OTP_MESSAGE', {
      lang,
      args: { code, minutes: expiresMinutes },
    });

    // 2. Build UltraMsg endpoint URL
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;

    try {
      // 3. Fire the request using RxJS pipeline transformed to a standard Promise
      const response = await firstValueFrom(
        this.httpService.post<UltraMsgResponse>(url, {
          token,
          to: fullPhoneNumber,
          body: messageBody,
        })
      );

      // UltraMsg usually returns an object containing { "sent": "true", "id": ... } 
      if (!response.data || (response.data.sent !== 'true' && !response.data.id)) {
        const upstreamError = this.i18n.t('auth.WHATSAPP_QUEUE_FAILED', { lang });
        throw new Error(upstreamError);
      }
    } catch (error: any) {
     const errorData = error.response?.data ? JSON.stringify(error.response.data) : error.message;
     this.logger.error(`Failed to dispatch WhatsApp OTP to ${fullPhoneNumber}. Reason:`, errorData);

      
     const gatewayError = this.i18n.t('auth.WHATSAPP_DELIVERY_FAILED', { lang });
     throw new BadGatewayException(gatewayError);
    }
  }

  async sendEmployeeCredentials(
  fullPhoneNumber: string,
  email: string,
  password: string,
  lang: string,
): Promise<void> {
  const instanceId = this.configService.get<string>('ULTRAMSG_INSTANCE_ID');
  const token = this.configService.get<string>('ULTRAMSG_TOKEN');

  const dashboardUrl = 'http://localhost:3000';

  const messageBody = this.i18n.t('auth.EMPLOYEE_CREDENTIALS_MESSAGE', {
    lang,
    args: {
      dashboardUrl,
      email,
      password,
    },
  });

  const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;

  try {
    const response = await firstValueFrom(
      this.httpService.post<UltraMsgResponse>(url, {
        token,
        to: fullPhoneNumber,
        body: messageBody,
      }),
    );

    if (!response.data || (response.data.sent !== 'true' && !response.data.id)) {
      const upstreamError = this.i18n.t('auth.WHATSAPP_QUEUE_FAILED', { lang });
      throw new Error(upstreamError);
    }
  } catch (error: any) {
    const errorData = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    this.logger.error(
      `Failed to dispatch employee credentials to ${fullPhoneNumber}. Reason:`,
      errorData,
    );

    const gatewayError = this.i18n.t('auth.WHATSAPP_DELIVERY_FAILED', { lang });
    throw new BadGatewayException(gatewayError);
  }
}

}
