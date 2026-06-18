import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class TranslationInterceptor implements NestInterceptor {
  constructor(private readonly i18n: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const lang = I18nContext.current(context)?.lang || 'ar';

    return next.handle().pipe(
      map((data) => {
        return this.processTranslation(data, lang);
      }),
    );
  }

  private processTranslation(data: any, lang: string): any {
    if (!data || typeof data !== 'object') return data;
    if (data instanceof Date) return data;
    if (Array.isArray(data)) {
      return data.map((item) => this.processTranslation(item, lang));
    }

    const result = {};

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        if (key === 'label' && data[key] && typeof data[key] === 'object' && 'ar' in data[key]) {
          result[key] = data[key][lang] || data[key]['ar'];
          continue;
        }
        if (key === 'name' && typeof data[key] === 'string' && data[key].includes(':')) {
          result[key] = data[key]; 
          
          result['translatedName'] = this.i18n.translate(`permissions.${data[key]}`, { lang });
          continue;
        }

        result[key] = this.processTranslation(data[key], lang);
      }
    }

    return result;
  }
}