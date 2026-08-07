import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CHECK_ABILITY } from '../decorators/abilities.decorator';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnnualReportController } from './annual-report.controller';

describe('AnnualReportController', () => {
  let annualReportService: any;
  let controller: AnnualReportController;

  beforeEach(() => {
    annualReportService = {
      create: jest.fn().mockResolvedValue({ success: true }),
    };
    controller = new AnnualReportController(annualReportService);
  });

  it('uses the admin sponsorship route and staff guards', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AnnualReportController)).toBe(
      'api/admin/sponsorships',
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AnnualReportController),
    ).toEqual([JwtAuthGuard, StaffOnlyGuard, AbilitiesGuard]);
  });

  it('requires create annual report permission', () => {
    expect(
      Reflect.getMetadata(
        CHECK_ABILITY,
        AnnualReportController.prototype.create,
      ),
    ).toEqual({ action: 'create', subject: 'AnnualReport' });
  });

  it('passes the sponsorship, authenticated staff, localized images, and language', async () => {
    const files = {
      reportImageAr: [
        { path: 'uploads/annual-reports/report-ar.jpg' } as Express.Multer.File,
      ],
      reportImageEn: [
        { path: 'uploads/annual-reports/report-en.jpg' } as Express.Multer.File,
      ],
    };
    const request = { user: { id: 20 } } as any;

    await controller.create(5, files, request, 'en');

    expect(annualReportService.create).toHaveBeenCalledWith(5, 20, files, 'en');
  });
});
