import { validate } from 'class-validator';
import {
  IsDateOfBirthNotInFuture,
  IsDateOfBirthWithinYears,
} from './date-of-birth.decorator';

class DateOfBirthDto {
  @IsDateOfBirthNotInFuture()
  @IsDateOfBirthWithinYears(100)
  dateOfBirth!: string;
}

describe('date of birth validators', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-21T12:00:00.000Z'));
  });

  afterAll(() => jest.useRealTimers());

  it.each(['1926-08-21', '1990-01-01', '2026-08-21'])(
    'accepts %s',
    async (dateOfBirth) => {
      const dto = Object.assign(new DateOfBirthDto(), { dateOfBirth });
      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it.each(['1926-08-20', '1500-01-01', '2026-08-22'])(
    'rejects %s',
    async (dateOfBirth) => {
      const dto = Object.assign(new DateOfBirthDto(), { dateOfBirth });
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});
