import { ApiProperty } from '@nestjs/swagger';
import { Transform, plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  registerDecorator,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

type SupportedTextScript = 'Arabic' | 'Latin';

function containsOnlyExpectedScriptLetters(
  value: unknown,
  expectedScript: SupportedTextScript,
): boolean {
  if (typeof value !== 'string') return false;

  const letters = Array.from(value).filter((character) =>
    /\p{L}/u.test(character),
  );
  if (letters.length === 0) return false;

  const expectedScriptPattern =
    expectedScript === 'Arabic' ? /\p{Script=Arabic}/u : /\p{Script=Latin}/u;

  return letters.every((letter) => expectedScriptPattern.test(letter));
}

function IsTextInScript(
  expectedScript: SupportedTextScript,
  messageKey:
    | 'validation.ARABIC_TEXT_REQUIRED'
    | 'validation.ENGLISH_TEXT_REQUIRED',
  validationOptions?: ValidationOptions,
) {
  return function (target: object, propertyKey: string) {
    registerDecorator({
      name: expectedScript === 'Arabic' ? 'isArabicText' : 'isEnglishText',
      target: target.constructor,
      propertyName: propertyKey,
      options: {
        message: i18nValidationMessage(messageKey),
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return containsOnlyExpectedScriptLetters(value, expectedScript);
        },
      },
    });
  };
}

export function IsArabicText(validationOptions?: ValidationOptions) {
  return IsTextInScript(
    'Arabic',
    'validation.ARABIC_TEXT_REQUIRED',
    validationOptions,
  );
}

export function IsEnglishText(validationOptions?: ValidationOptions) {
  return IsTextInScript(
    'Latin',
    'validation.ENGLISH_TEXT_REQUIRED',
    validationOptions,
  );
}

export class BilingualTextDto {
  @ApiProperty({ example: 'دمشق - المزة' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @IsArabicText()
  ar!: string;

  @ApiProperty({ example: 'Damascus - Al Mazzeh' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @IsEnglishText()
  en!: string;
}

export function ParseBilingualText() {
  return function (target: object, propertyKey: string) {
    Transform(({ value }) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      let parsedValue = value;

      if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (!trimmedValue) return undefined;

        try {
          parsedValue = JSON.parse(trimmedValue);
        } catch {
          return value;
        }
      }

      return plainToInstance(BilingualTextDto, parsedValue);
    })(target, propertyKey);

    ValidateNested()(target, propertyKey);
  };
}
