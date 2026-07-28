import { PRESERVE_BILINGUAL_RESPONSE } from '../../decorators/preserve-bilingual-response.decorator';
import { AdminHelpRequestsController } from './admin-help-requests.controller';
import { PublicDonorAidRequestsController } from './public-donor-aid-requests.controller';

describe('AdminHelpRequestsController response translation metadata', () => {
  it('preserves bilingual JSON fields for admin help request responses', () => {
    expect(
      Reflect.getMetadata(
        PRESERVE_BILINGUAL_RESPONSE,
        AdminHelpRequestsController,
      ),
    ).toBe(true);
  });

  it('does not change public donor localized responses', () => {
    expect(
      Reflect.getMetadata(
        PRESERVE_BILINGUAL_RESPONSE,
        PublicDonorAidRequestsController,
      ),
    ).toBeUndefined();
  });
});
