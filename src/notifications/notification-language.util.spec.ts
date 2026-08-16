import { normalizeNotificationLanguage } from './notification-language.util';

describe('normalizeNotificationLanguage', () => {
  it.each([
    ['en', 'en'],
    ['en-US', 'en'],
    ['en_US', 'en'],
    ['en-US,en;q=0.9', 'en'],
    ['ar', 'ar'],
    ['ar-SY', 'ar'],
    [undefined, 'ar'],
    ['fr', 'ar'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeNotificationLanguage(input)).toBe(expected);
  });
});
