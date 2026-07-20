import parsePhoneNumberFromString from 'libphonenumber-js';

export interface NormalizedPhoneNumber {
  countryCode: string;
  number: string;
  e164: string;
}

function toNormalizedPhoneNumber(value: string): NormalizedPhoneNumber | null {
  const parsedNumber = parsePhoneNumberFromString(value);

  if (!parsedNumber || !parsedNumber.isValid()) {
    return null;
  }

  return {
    countryCode: `+${parsedNumber.countryCallingCode}`,
    number: parsedNumber.nationalNumber,
    e164: parsedNumber.format('E.164'),
  };
}

export function normalizePhoneComponents(
  countryCode: string,
  number: string,
): NormalizedPhoneNumber | null {
  const cleanCountryCode = countryCode.trim().startsWith('+')
    ? countryCode.trim()
    : `+${countryCode.trim()}`;

  return toNormalizedPhoneNumber(`${cleanCountryCode}${number.trim()}`);
}

export function normalizeFullPhoneNumber(
  phoneNumber: string,
): NormalizedPhoneNumber | null {
  const cleanPhoneNumber = phoneNumber.trim().startsWith('+')
    ? phoneNumber.trim()
    : `+${phoneNumber.trim()}`;

  return toNormalizedPhoneNumber(cleanPhoneNumber);
}
