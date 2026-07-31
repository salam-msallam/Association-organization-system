import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BilingualTextDto } from './bilingual-text.dto';

describe('BilingualTextDto', () => {
  async function validateText(ar: unknown, en: unknown) {
    const dto = plainToInstance(BilingualTextDto, { ar, en });
    const errors = await validate(dto);

    return { dto, errors };
  }

  it('trims and accepts Arabic and English text in their correct fields', async () => {
    const { dto, errors } = await validateText(
      '  دمشق - منطقة 10  ',
      '  Damascus - Area 10  ',
    );

    expect(errors).toEqual([]);
    expect(dto.ar).toBe('دمشق - منطقة 10');
    expect(dto.en).toBe('Damascus - Area 10');
  });

  it.each([
    ['   ', 'Damascus'],
    ['دمشق', '   '],
    ['   ', '   '],
  ])('rejects blank values after trimming', async (ar, en) => {
    const { errors } = await validateText(ar, en);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects English text in the Arabic field', async () => {
    const { errors } = await validateText('Damascus', 'Damascus');

    expect(errors.some((error) => error.property === 'ar')).toBe(true);
  });

  it('rejects Arabic text in the English field', async () => {
    const { errors } = await validateText('دمشق', 'دمشق');

    expect(errors.some((error) => error.property === 'en')).toBe(true);
  });

  it.each([
    ['دمشق Damascus', 'Damascus'],
    ['دمشق', 'Damascus دمشق'],
  ])('rejects mixed Arabic and English letters', async (ar, en) => {
    const { errors } = await validateText(ar, en);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects values containing only numbers or punctuation', async () => {
    const { errors } = await validateText('123 - !!!', '123 - !!!');

    expect(errors).toHaveLength(2);
  });
});
