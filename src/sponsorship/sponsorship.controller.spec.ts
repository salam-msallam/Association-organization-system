import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SponsorshipController } from './sponsorship.controller';

describe('SponsorshipController orphan summary', () => {
  let service: any;
  let controller: SponsorshipController;

  beforeEach(() => {
    service = {
      findOrphanSummary: jest.fn().mockResolvedValue({ success: true }),
    };
    controller = new SponsorshipController(service);
  });

  it('exposes a separate JWT-protected orphan summary route', () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        SponsorshipController.prototype.findOrphanSummary,
      ),
    ).toBe(':sponsorshipId/orphan-summary');
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        SponsorshipController.prototype.findOrphanSummary,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('passes the sponsorship id, donor JWT payload, and language to the service', async () => {
    const request = { user: { id: 7, type: 'DONOR' } } as any;

    await controller.findOrphanSummary(8, request, 'en');

    expect(service.findOrphanSummary).toHaveBeenCalledWith(
      8,
      request.user,
      'en',
    );
  });
});
