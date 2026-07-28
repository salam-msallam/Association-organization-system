import { PRESERVE_BILINGUAL_RESPONSE } from '../decorators/preserve-bilingual-response.decorator';
import { AdminBeneficiariesController } from './beneficiary.controller';

describe('AdminBeneficiariesController response translation metadata', () => {
  it('preserves bilingual JSON fields for admin beneficiary responses', () => {
    expect(
      Reflect.getMetadata(
        PRESERVE_BILINGUAL_RESPONSE,
        AdminBeneficiariesController,
      ),
    ).toBe(true);
  });
});
