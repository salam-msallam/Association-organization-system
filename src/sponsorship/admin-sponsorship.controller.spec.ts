import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Status } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { StaffOnlyGuard } from '../guards/staff-only.guard';
import { AdminSponsorshipController } from './admin-sponsorship.controller';

describe('AdminSponsorshipController', () => {
  let sponsorshipService: any;
  let controller: AdminSponsorshipController;

  beforeEach(() => {
    sponsorshipService = {
      findAllForStaff: jest.fn(),
      findOneForStaff: jest.fn(),
      reviewStatus: jest.fn(),
    };
    controller = new AdminSponsorshipController(sponsorshipService);
  });

  it('uses the admin sponsorship route and staff authorization guards', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminSponsorshipController)).toBe(
      'api/admin/sponsorships',
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminSponsorshipController),
    ).toEqual([JwtAuthGuard, StaffOnlyGuard, AbilitiesGuard]);
  });

  it('passes the optional status filter and pagination to the service', async () => {
    sponsorshipService.findAllForStaff.mockResolvedValue({ data: [] });

    await controller.findAll('PENDING', '2', '5', 'en');

    expect(sponsorshipService.findAllForStaff).toHaveBeenCalledWith(
      'PENDING',
      'en',
      '2',
      '5',
    );
  });

  it('passes the staff user ID and review payload to the service', async () => {
    const dto = { status: Status.ACCEPTED, orphanId: 3 };
    const req = { user: { id: 20 } } as any;
    sponsorshipService.reviewStatus.mockResolvedValue({ success: true });

    await controller.reviewStatus(5, dto, req, 'ar');

    expect(sponsorshipService.reviewStatus).toHaveBeenCalledWith(
      5,
      20,
      dto,
      'ar',
    );
  });

  it('passes the sponsorship ID and language to the detail service', async () => {
    sponsorshipService.findOneForStaff.mockResolvedValue({ success: true });

    await controller.findOne(5, 'en');

    expect(sponsorshipService.findOneForStaff).toHaveBeenCalledWith(5, 'en');
  });
});
