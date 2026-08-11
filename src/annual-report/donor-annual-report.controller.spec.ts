import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DonorAnnualReportController } from './donor-annual-report.controller';

describe('DonorAnnualReportController', () => {
  let service: any;
  let controller: DonorAnnualReportController;

  beforeEach(() => {
    service = {
      findForDonor: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };
    controller = new DonorAnnualReportController(service);
  });

  it('uses the donor sponsorship route and JWT guard', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, DonorAnnualReportController),
    ).toBe('sponsorships');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        DonorAnnualReportController.prototype.findMine,
      ),
    ).toBe(':sponsorshipId/annual-reports');
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DonorAnnualReportController.prototype.findMine,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('passes sponsorship, donor token payload, and language to the service', async () => {
    const request = { user: { id: 20, type: 'DONOR' } } as any;

    await controller.findMine(5, request, 'en');

    expect(service.findForDonor).toHaveBeenCalledWith(5, request.user, 'en');
  });
});
