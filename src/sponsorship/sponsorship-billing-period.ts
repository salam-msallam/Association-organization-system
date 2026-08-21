import { DateTime } from 'luxon';

export const SPONSORSHIP_TIME_ZONE = 'Asia/Damascus';
export const SPONSORSHIP_RENEWAL_DAY = 20;

export type SponsorshipReminderStage = 'DAY_20' | 'DAY_25' | 'FINAL_DAY';

export interface SponsorshipPaymentContext {
  coveredMonth: string;
  isRenewalWindowOpen: boolean;
  currentMonthStart: Date;
  nextMonthStart: Date;
  renewalWindowStart: Date;
  renewalWindowEnd: Date;
}

export interface PreviousRenewalWindow {
  coveredMonth: string;
  currentMonthStart: Date;
  databaseCurrentMonthStart: Date;
  renewalWindowStart: Date;
  renewalWindowEnd: Date;
}

export interface SponsorshipReminderContext {
  coveredMonth: string;
  stage: SponsorshipReminderStage;
  renewalWindowStart: Date;
  renewalWindowEnd: Date;
  notificationDayStart: Date;
}

export interface SponsorshipPaymentRecord {
  coveredMonth: string | null;
  createdAt: Date;
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
    coveredMonth: currentMonthStart.toFormat('yyyy-MM'),
    currentMonthStart: toUtcDate(currentMonthStart),
    databaseCurrentMonthStart: toDatabaseDate(currentMonthStart),
    renewalWindowStart: toUtcDate(renewalWindowStart),
    renewalWindowEnd: toUtcDate(currentMonthStart),
  };
}

export function getFirstSponsorshipCoveredMonth(startDate: Date): string {
  // startDate is stored as a MySQL DATE, so its UTC components are the
  // calendar date selected when the sponsorship was accepted.
  const acceptedAt = DateTime.fromJSDate(startDate, { zone: 'utc' });
  const firstCoveredMonth =
    acceptedAt.day >= SPONSORSHIP_RENEWAL_DAY
      ? acceptedAt.plus({ months: 1 })
      : acceptedAt;

  return firstCoveredMonth.toFormat('yyyy-MM');
}

export function inferLegacyCoveredMonth(createdAt: Date): string {
  return getSponsorshipPaymentContext(createdAt).coveredMonth;
}

export function getPaidSponsorshipMonths(
  startDate: Date,
  payments: SponsorshipPaymentRecord[],
): Set<string> {
  const firstCoveredMonth = getFirstSponsorshipCoveredMonth(startDate);

  return new Set(
    payments.map((payment, index) => {
      if (payment.coveredMonth) return payment.coveredMonth;

      // Before coveredMonth was persisted, the oldest transaction represents
      // the first installment. Applying the current rule keeps old data
      // compatible with the first-payment exception.
      return index === 0
        ? firstCoveredMonth
        : inferLegacyCoveredMonth(payment.createdAt);
    }),
  );
}

export function getSponsorshipReminderContext(
  now = new Date(),
): SponsorshipReminderContext | null {
  const localNow = inDamascus(now);
  const lastDayOfMonth = localNow.daysInMonth;
  let stage: SponsorshipReminderStage | null = null;

  if (localNow.day === SPONSORSHIP_RENEWAL_DAY) {
    stage = 'DAY_20';
  } else if (localNow.day === 25) {
    stage = 'DAY_25';
  } else if (localNow.day === lastDayOfMonth) {
    stage = 'FINAL_DAY';
  }

  if (!stage) return null;

  const currentMonthStart = localNow.startOf('month');
  const nextMonthStart = currentMonthStart.plus({ months: 1 });

  return {
    coveredMonth: nextMonthStart.toFormat('yyyy-MM'),
    stage,
    renewalWindowStart: toUtcDate(
      currentMonthStart.set({ day: SPONSORSHIP_RENEWAL_DAY }),
    ),
    renewalWindowEnd: toUtcDate(nextMonthStart),
    notificationDayStart: toUtcDate(localNow.startOf('day')),
  };
}

export function toSponsorshipDatabaseDate(now = new Date()): Date {
  return toDatabaseDate(inDamascus(now));
}
