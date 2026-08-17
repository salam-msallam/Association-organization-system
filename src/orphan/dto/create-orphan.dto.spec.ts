import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrphanDto } from './create-orphan.dto';

describe('CreateOrphanDto priority', () => {
  const validatePriority = async (priority: unknown) => {
    const dto = plainToInstance(CreateOrphanDto, { priority });
    const errors = await validate(dto, { skipMissingProperties: true });

    return errors.find((error) => error.property === 'priority');
  };

  it.each([1, 3, 5, '5'])('accepts priority %p', async (priority) => {
    await expect(validatePriority(priority)).resolves.toBeUndefined();
  });

  it.each([0, 6, 2.5, 'invalid'])('rejects priority %p', async (priority) => {
    await expect(validatePriority(priority)).resolves.toBeDefined();
  });
});
