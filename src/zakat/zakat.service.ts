import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CalculateZakatDto } from './dto/calculate-zakat.dto';
import { ZakatResultDto } from './dto/zakat-result.dto';
import { ZakatType } from './zakat-type.enum';

@Injectable()
export class ZakatService {
  private readonly goldNisabGrams = new Prisma.Decimal(85);
  private readonly silverNisabGrams = new Prisma.Decimal(595);
  private readonly zakatRate = new Prisma.Decimal('0.025');

  calculate(
    type: ZakatType,
    dto: CalculateZakatDto,
    lang = 'ar',
  ): ZakatResultDto {
    const gramPrice = this.positiveDecimal(dto.gramPrice, 'gramPrice');
    const amount = this.positiveDecimal(dto.amount, 'amount');
    const isMoney = type === ZakatType.MONEY;
    const nisabAmount = isMoney
      ? this.goldNisabGrams.mul(gramPrice)
      : type === ZakatType.GOLD
        ? this.goldNisabGrams
        : this.silverNisabGrams;
    const eligible = amount.greaterThan(nisabAmount);
    const assetValue = isMoney ? amount : amount.mul(gramPrice);
    const zakatDue = eligible
      ? assetValue.mul(this.zakatRate)
      : new Prisma.Decimal(0);

    return {
      type,
      eligible,
      amount: isMoney ? amount.toFixed(2) : amount.toFixed(3),
      amountUnit: isMoney ? 'USD' : 'GRAMS',
      nisabAmount: isMoney ? nisabAmount.toFixed(2) : nisabAmount.toFixed(3),
      nisabUnit: isMoney ? 'USD' : 'GRAMS',
      gramPrice: gramPrice.toFixed(6),
      assetValue: assetValue.toFixed(2),
      zakatRate: this.zakatRate.toString(),
      zakatDue: zakatDue.toFixed(2),
      currency: 'USD',
      message: this.message(type, eligible, zakatDue, lang),
    };
  }

  private positiveDecimal(
    value: string | undefined,
    field: string,
  ): Prisma.Decimal {
    if (value === undefined) {
      throw new BadRequestException(`${field} is required`);
    }

    const decimal = new Prisma.Decimal(value);
    if (decimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException(`${field} must be greater than zero`);
    }
    return decimal;
  }

  private message(
    type: ZakatType,
    eligible: boolean,
    zakatDue: Prisma.Decimal,
    lang: string,
  ): string {
    const arabic = lang.toLowerCase().startsWith('ar');
    if (!eligible) {
      const asset =
        type === ZakatType.MONEY
          ? 'المال'
          : type === ZakatType.GOLD
            ? 'الذهب'
            : 'الفضة';
      return arabic
        ? `${asset} لم يبلغ النصاب بعد`
        : `${type.toLowerCase()} has not reached the nisab yet`;
    }

    return arabic
      ? `بلغ النصاب، ومبلغ الزكاة الواجب هو ${zakatDue.toFixed(2)} دولار`
      : `Nisab has been reached; the zakat due is USD ${zakatDue.toFixed(2)}`;
  }
}
