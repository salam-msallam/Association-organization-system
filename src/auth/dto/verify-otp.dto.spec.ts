import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyOtpDto } from './verify-otp.dto';

describe('VerifyOtpDto', () => {
  const validPayload = {
    countryCode: '+963',
    number: '934206455',
    code: '1234',
  };

  it('allows registration without a Firebase registration identifier', async () => {
    const dto = plainToInstance(VerifyOtpDto, validPayload);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('trims and accepts a valid Firebase registration identifier', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      ...validPayload,
      registrationId: '  firebase-registration-id  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.registrationId).toBe('firebase-registration-id');
  });

  it('rejects an empty Firebase registration identifier', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      ...validPayload,
      registrationId: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'registrationId' }),
      ]),
    );
  });
});
