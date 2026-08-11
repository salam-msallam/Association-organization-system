import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'syrianUserPhoneNumber', async: false })
export class SyrianUserPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const dto = args.object as { countryCode?: unknown };

    if (dto.countryCode !== '+963') {
      return true;
    }

    return typeof value === 'string' && /^\d{9}$/.test(value);
  }
}
