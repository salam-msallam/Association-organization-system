import { DateTime } from 'luxon';

export const SPONSORSHIP_TIME_ZONE = 'Asia/Damascus';
export const SPONSORSHIP_RENEWAL_DAY = 20;

export interface SponsorshipPaymentContext {
  coveredMonth: string;
  isRenewalWindowOpen: boolean;
  currentMonthStart: Date;
  nextMonthStart: Date;
  renewalWindowStart: Date;
  renewalWindowEnd: Date;
}

export interface PreviousRenewalWindow {
  currentMonthStart: Date;
  databaseCurrentMonthStart: Date;
  renewalWindowStart: Date;
  renewalWindowEnd: Date;
}

function inDamascus(now: Date): DateTime {
  return DateTime.fromJSDate(now, { zone: 'utc' }).setZone(
    SPONSORSHIP_TIME_ZONE,
  );
}

function toUtcDate(value: DateTime): Date {
  return value.toUTC().toJSDate();
}

function toDatabaseDate(value: DateTime): Date {
  const isoDate = value.toISODate();

  if (!isoDate) {
    throw new Error('Unable to calculate sponsorship billing date.');
  }

  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function getSponsorshipPaymentContext(
  now = new Date(),
): SponsorshipPaymentContext {
  const localNow = inDamascus(now);
  const currentMonthStart = localNow.startOf('month');
  const renewalWindowStart = currentMonthStart.set({
    day: SPONSORSHIP_RENEWAL_DAY,
  });
  const nextMonthStart = currentMonthStart.plus({ months: 1 });
  const isRenewalWindowOpen = localNow.day >= SPONSORSHIP_RENEWAL_DAY;
  const coveredMonth = (
    isRenewalWindowOpen ? localNow.plus({ months: 1 }) : localNow
  ).toFormat('yyyy-MM');

  return {
    coveredMonth,
    isRenewalWindowOpen,
    currentMonthStart: toUtcDate(currentMonthStart),
    nextMonthStart: toUtcDate(nextMonthStart),
    renewalWindowStart: toUtcDate(renewalWindowStart),
    renewalWindowEnd: toUtcDate(nextMonthStart),
  };
}

export function getPreviousRenewalWindow(
  now = new Date(),
): PreviousRenewalWindow {
  const currentMonthStart = inDamascus(now).startOf('month');
  const previousMonthStart = currentMonthStart.minus({ months: 1 });
  const renewalWindowStart = previousMonthStart.set({
    day: SPONSORSHIP_RENEWAL_DAY,
  });

  return {
    currentMonthStart: toUtcDate(currentMonthStart),
    databaseCurrentMonthStart: toDatabaseDate(currentMonthStart),
    renewalWindowStart: toUtcDate(renewalWindowStart),
    renewalWindowEnd: toUtcDate(currentMonthStart),
  };
}

export function toSponsorshipDatabaseDate(now = new Date()): Date {
  return toDatabaseDate(inDamascus(now));
}
