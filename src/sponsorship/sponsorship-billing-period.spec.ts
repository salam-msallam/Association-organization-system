import {
  getFirstSponsorshipCoveredMonth,
  getPaidSponsorshipMonths,
  getPreviousRenewalWindow,
  getSponsorshipPaymentContext,
  getSponsorshipReminderContext,
} from './sponsorship-billing-period';

describe('sponsorship billing periods', () => {
  it('treats a first payment before day 20 in Damascus as current-month coverage', () => {
    const context = getSponsorshipPaymentContext(
      new Date('2026-07-19T20:00:00.000Z'),
    );

    expect(context.isRenewalWindowOpen).toBe(false);
    expect(context.coveredMonth).toBe('2026-07');
    expect(context.currentMonthStart).toEqual(
      new Date('2026-06-30T21:00:00.000Z'),
    );
    expect(context.nextMonthStart).toEqual(
      new Date('2026-07-31T21:00:00.000Z'),
    );
  });

  it('opens renewal on day 20 in Damascus and covers the following month', () => {
    const context = getSponsorshipPaymentContext(
      new Date('2026-07-19T21:00:00.000Z'),
    );

    expect(context.isRenewalWindowOpen).toBe(true);
    expect(context.coveredMonth).toBe('2026-08');
    expect(context.renewalWindowStart).toEqual(
      new Date('2026-07-19T21:00:00.000Z'),
    );
    expect(context.renewalWindowEnd).toEqual(
      new Date('2026-07-31T21:00:00.000Z'),
    );
  });

  it('calculates month boundaries across the end of the year in Damascus', () => {
    const context = getSponsorshipPaymentContext(
      new Date('2027-01-25T09:00:00.000Z'),
    );

    expect(context.coveredMonth).toBe('2027-02');
    expect(context.currentMonthStart).toEqual(
      new Date('2026-12-31T21:00:00.000Z'),
    );
    expect(context.renewalWindowStart).toEqual(
      new Date('2027-01-19T21:00:00.000Z'),
    );
    expect(context.nextMonthStart).toEqual(
      new Date('2027-01-31T21:00:00.000Z'),
    );
  });

  it('calculates the previous renewal window across leap-year February', () => {
    const window = getPreviousRenewalWindow(
      new Date('2028-03-01T09:00:00.000Z'),
    );

    expect(window.renewalWindowStart).toEqual(
      new Date('2028-02-19T21:00:00.000Z'),
    );
    expect(window.renewalWindowEnd).toEqual(
      new Date('2028-02-29T21:00:00.000Z'),
    );
    expect(window.databaseCurrentMonthStart).toEqual(
      new Date('2028-03-01T00:00:00.000Z'),
    );
  });

  it('keeps the first installment in the acceptance month when accepted before day 20', () => {
    expect(
      getFirstSponsorshipCoveredMonth(new Date('2026-08-12T00:00:00.000Z')),
    ).toBe('2026-08');
  });

  it('moves the first installment to the next month when accepted on day 20 or later', () => {
    expect(
      getFirstSponsorshipCoveredMonth(new Date('2026-08-20T00:00:00.000Z')),
    ).toBe('2026-09');
  });

  it('interprets a legacy delayed first payment using the first-payment rule', () => {
    const paidMonths = getPaidSponsorshipMonths(
      new Date('2026-08-12T00:00:00.000Z'),
      [
        {
          coveredMonth: null,
          createdAt: new Date('2026-08-22T09:00:00.000Z'),
        },
      ],
    );

    expect(paidMonths.has('2026-08')).toBe(true);
    expect(paidMonths.has('2026-09')).toBe(false);
  });

  it('creates reminders only on day 20, day 25, and the actual final day', () => {
    expect(
      getSponsorshipReminderContext(new Date('2028-02-19T21:00:00.000Z')),
    ).toMatchObject({ coveredMonth: '2028-03', stage: 'DAY_20' });
    expect(
      getSponsorshipReminderContext(new Date('2028-02-24T21:00:00.000Z')),
    ).toMatchObject({ coveredMonth: '2028-03', stage: 'DAY_25' });
    expect(
      getSponsorshipReminderContext(new Date('2028-02-28T21:00:00.000Z')),
    ).toMatchObject({ coveredMonth: '2028-03', stage: 'FINAL_DAY' });
    expect(
      getSponsorshipReminderContext(new Date('2028-02-26T09:00:00.000Z')),
    ).toBeNull();
  });
});
