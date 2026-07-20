import {
  normalizeFullPhoneNumber,
  normalizePhoneComponents,
} from './phone-number.util';

describe('phone number utilities', () => {
  it('normalizes a valid Syrian phone number from components', () => {
    expect(normalizePhoneComponents('+963', '934206455')).toEqual({
      countryCode: '+963',
      number: '934206455',
      e164: '+963934206455',
    });
  });

  it('normalizes a valid UAE mobile phone number from components', () => {
    expect(normalizePhoneComponents('+971', '501234567')).toEqual({
      countryCode: '+971',
      number: '501234567',
      e164: '+971501234567',
    });
  });

  it('canonicalizes an accepted local trunk zero', () => {
    expect(normalizePhoneComponents('+971', '0501234567')).toEqual({
      countryCode: '+971',
      number: '501234567',
      e164: '+971501234567',
    });
  });

  it('rejects an invalid UAE phone number', () => {
    expect(normalizePhoneComponents('+971', '121212122')).toBeNull();
    expect(normalizeFullPhoneNumber('+971121212122')).toBeNull();
  });

  it('normalizes full international input with or without a leading plus', () => {
    expect(normalizeFullPhoneNumber('+971501234567')).toEqual({
      countryCode: '+971',
      number: '501234567',
      e164: '+971501234567',
    });

    expect(normalizeFullPhoneNumber('971501234567')).toEqual({
      countryCode: '+971',
      number: '501234567',
      e164: '+971501234567',
    });
  });
});
