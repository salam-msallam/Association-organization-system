import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { PRESERVE_BILINGUAL_RESPONSE } from '../decorators/preserve-bilingual-response.decorator';
import { PRESERVE_LABEL_RESPONSE } from '../decorators/preserve-label-response.decorator';

@Injectable()
export class TranslationInterceptor implements NestInterceptor {
  constructor(
    private readonly i18n: I18nService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const lang = I18nContext.current(context)?.lang || 'ar';
    const preserveBilingualResponse = this.reflector.getAllAndOverride<boolean>(
      PRESERVE_BILINGUAL_RESPONSE,
      [context.getHandler(), context.getClass()],
    );
    const preserveLabelResponse = this.reflector.getAllAndOverride<boolean>(
      PRESERVE_LABEL_RESPONSE,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => {
        return this.processTranslation(
          data,
          lang,
          preserveBilingualResponse,
          preserveLabelResponse,
        );
      }),
    );
  }

  private processTranslation(
    data: any,
    lang: string,
    preserveBilingualResponse = false,
    preserveLabelResponse = false,
  ): any {
    if (!data || typeof data !== 'object') return data;
    if (data instanceof Date) return data;

    // أي object عنده toJSON خاص به (زي Decimal من Prisma) لازم يتحول
    // عبر toJSON مباشرة، مش نفكّ خصائصه الداخلية (s, e, d) عبر for...in
    if (typeof data.toJSON === 'function') {
      return data.toJSON();
    }

    // أي حقل ثنائي اللغة عام شكله {ar: '...', en: '...'} (مهما كان اسمه:
    // address, name, title, details, institutionName...) بيتحول مباشرة
    // لقيمة اللغة المطلوبة، بدل ما يترجع الـ object كامل
    if (!preserveBilingualResponse && this.isBilingualObject(data)) {
      return data[lang] ?? data['ar'];
    }

    if (Array.isArray(data)) {
      return data.map((item) =>
        this.processTranslation(
          item,
          lang,
          preserveBilingualResponse,
          preserveLabelResponse,
        ),
      );
    }

    const result = {};

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        if (
          key === 'label' &&
          data[key] &&
          typeof data[key] === 'object' &&
          'ar' in data[key]
        ) {
          result[key] = preserveLabelResponse
            ? data[key]
            : data[key][lang] || data[key]['ar'];
          continue;
        }
        if (key === 'name' && typeof data[key] === 'string' && data[key].includes(':')) {
          result[key] = data[key]; 
          
          result['translatedName'] = this.i18n.translate(`permissions.${data[key]}`, { lang });
          continue;
        }

        result[key] = this.processTranslation(
          data[key],
          lang,
          preserveBilingualResponse,
          preserveLabelResponse,
        );
      }
    }

    return result;
  }

  private isBilingualObject(value: any): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const keys = Object.keys(value);

    return (
      keys.length === 2 &&
      keys.includes('ar') &&
      keys.includes('en') &&
      typeof value.ar === 'string' &&
      typeof value.en === 'string'
    );
  }
}
