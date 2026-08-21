import { registerDecorator, ValidationOptions } from 'class-validator';

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function IsDateOfBirthNotInFuture(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isDateOfBirthNotInFuture',
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          const date = parseDateOnly(value);
          if (!date) return true;

          const today = new Date();
          const todayUtc = Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
          );
          return date.getTime() <= todayUtc;
        },
      },
    });
  };
}

export function IsDateOfBirthWithinYears(
  years: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isDateOfBirthWithinYears',
      target: object.constructor,
      propertyName: propertyName.toString(),
      constraints: [years],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          const date = parseDateOnly(value);
          if (!date) return true;

          const today = new Date();
          const oldestAllowed = Date.UTC(
            today.getUTCFullYear() - years,
            today.getUTCMonth(),
            today.getUTCDate(),
          );
          return date.getTime() >= oldestAllowed;
        },
      },
    });
  };
}
