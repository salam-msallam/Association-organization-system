import { BadRequestException } from '@nestjs/common';
import { ZakatService } from './zakat.service';
import { ZakatType } from './zakat-type.enum';

describe('ZakatService', () => {
  const service = new ZakatService();

  it('calculates money zakat using the 85g gold nisab', () => {
    const result = service.calculate(ZakatType.MONEY, {
      amount: '10000',
      gramPrice: '100',
    });

    expect(result.eligible).toBe(true);
    expect(result.nisabAmount).toBe('8500.00');
    expect(result.amountUnit).toBe('USD');
    expect(result.zakatDue).toBe('250.00');
  });

  it('returns zero when money has not reached nisab', () => {
    const result = service.calculate(ZakatType.MONEY, {
      amount: '7000',
      gramPrice: '100',
    });

    expect(result.eligible).toBe(false);
    expect(result.zakatDue).toBe('0.00');
    expect(result.message).toBe('المال لم يبلغ النصاب بعد');
  });

  it('calculates gold zakat at exactly 85 grams', () => {
    const result = service.calculate(ZakatType.GOLD, {
      amount: '85',
      gramPrice: '100',
    });

    expect(result.eligible).toBe(true);
    expect(result.amount).toBe('85.000');
    expect(result.amountUnit).toBe('GRAMS');
    expect(result.nisabAmount).toBe('85.000');
    expect(result.assetValue).toBe('8500.00');
    expect(result.zakatDue).toBe('212.50');
  });

  it('calculates gold zakat above 85 grams', () => {
    const result = service.calculate(ZakatType.GOLD, {
      amount: '85.001',
      gramPrice: '100',
    });

    expect(result.eligible).toBe(true);
    expect(result.zakatDue).toBe('212.50');
  });

  it('uses 595 grams as the silver nisab', () => {
    const result = service.calculate(ZakatType.SILVER, {
      amount: '594.999',
      gramPrice: '1.2',
    });

    expect(result.eligible).toBe(false);
    expect(result.nisabAmount).toBe('595.000');
    expect(result.nisabUnit).toBe('GRAMS');
    expect(result.zakatDue).toBe('0.00');
  });

  it('rejects zero or negative inputs', () => {
    expect(() =>
      service.calculate(ZakatType.GOLD, {
        amount: '0',
        gramPrice: '100',
      }),
    ).toThrow(BadRequestException);
  });
});
