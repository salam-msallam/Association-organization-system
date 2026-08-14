export type NotificationLanguage = 'ar' | 'en';

export function normalizeNotificationLanguage(
  language: string | undefined,
): NotificationLanguage {
  const primaryLanguage = language
    ?.split(',')[0]
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return primaryLanguage === 'en' ? 'en' : 'ar';
}
