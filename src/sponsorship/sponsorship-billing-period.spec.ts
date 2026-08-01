import {
  getPreviousRenewalWindow,
  getSponsorshipPaymentContext,
} from './sponsorship-billing-period';

describe('sponsorship billing periods', () => {
  it('treats a first payment before day 20 in Damascus as current-month coverage', () => {
    const context = getSponsorshipPaymentContext(
      new Date('2026-07-19T20:00:00.000Z'),
    );

    expect(context.isRenewalWindowOpen).toBe(false);
    expect(context.coveredMonth).toBe('2026-07');
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
});
