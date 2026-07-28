import { TranslationInterceptor } from './translation.interceptor';

describe('TranslationInterceptor', () => {
  const i18n = {
    translate: jest.fn((key: string) => key),
  };
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  let interceptor: TranslationInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new TranslationInterceptor(i18n as any, reflector as any);
  });

  it('localizes generic bilingual objects by default', () => {
    const result = (interceptor as any).processTranslation(
      {
        data: {
          class: { ar: 'الصف الرابع', en: 'Fourth grade' },
        },
      },
      'ar',
    );

    expect(result.data.class).toBe('الصف الرابع');
  });

  it('preserves generic bilingual objects when requested', () => {
    const bilingualClass = { ar: 'الصف الرابع', en: 'Fourth grade' };

    const result = (interceptor as any).processTranslation(
      {
        data: {
          class: bilingualClass,
        },
      },
      'ar',
      true,
    );

    expect(result.data.class).toEqual(bilingualClass);
  });

  it('still localizes label fields when preserving generic bilingual data', () => {
    const result = (interceptor as any).processTranslation(
      {
        label: { ar: 'مدير', en: 'Manager' },
        data: {
          address: { ar: 'دمشق', en: 'Damascus' },
        },
      },
      'en',
      true,
    );

    expect(result.label).toBe('Manager');
    expect(result.data.address).toEqual({ ar: 'دمشق', en: 'Damascus' });
  });
});
