import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PRESERVE_BILINGUAL_RESPONSE } from '../decorators/preserve-bilingual-response.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DonorMobileController } from './donor-mobile.controller';
import { DonorController } from './donor.controller';

describe('DonorController', () => {
  let donorService: any;
  let controller: DonorController;
  let mobileController: DonorMobileController;

  beforeEach(() => {
    donorService = {
      findAll: jest.fn(),
      getHistory: jest.fn(),
      getSponsorshipProfile: jest.fn(),
      getMyHistory: jest.fn(),
    };
    controller = new DonorController(donorService);
    mobileController = new DonorMobileController(donorService);
  });

  it('uses the admin donors route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DonorController)).toBe(
      'api/admin/donors',
    );
  });

  it('preserves bilingual JSON fields for donor history responses', () => {
    expect(
      Reflect.getMetadata(PRESERVE_BILINGUAL_RESPONSE, DonorController),
    ).toBe(true);
  });

  it('protects donor routes with class-level guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DonorController)).toHaveLength(
      3,
    );
  });

  it('requires read access to the Donor subject', () => {
    expect(
      Reflect.getMetadata('check_ability', DonorController.prototype.findAll),
    ).toEqual({ action: 'read', subject: 'Donor' });
    expect(
      Reflect.getMetadata(
        'check_ability',
        DonorController.prototype.getHistory,
      ),
    ).toEqual({ action: 'read', subject: 'Donor' });
  });

  it('requires sponsorship read access for the donor sponsorship profile', () => {
    expect(
      Reflect.getMetadata(
        'check_ability',
        DonorController.prototype.getSponsorshipProfile,
      ),
    ).toEqual({ action: 'read', subject: 'Sponsorship' });
  });

  it('passes list query parameters to the service', async () => {
    donorService.findAll.mockResolvedValue({ data: [] });

    await controller.findAll('2', '25', 'false', 'en');

    expect(donorService.findAll).toHaveBeenCalledWith('2', '25', 'false', 'en');
  });

  it('passes donor ID params to the history service', async () => {
    donorService.getHistory.mockResolvedValue({ data: [] });

    await controller.getHistory('3', 'ar');

    expect(donorService.getHistory).toHaveBeenCalledWith('3', 'ar');
  });

  it('passes donor ID and language to the sponsorship profile service', async () => {
    donorService.getSponsorshipProfile.mockResolvedValue({ data: {} });

    await controller.getSponsorshipProfile('3', 'en');

    expect(donorService.getSponsorshipProfile).toHaveBeenCalledWith('3', 'en');
  });

  it('uses the mobile donor me route prefix without preserving bilingual responses', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DonorMobileController)).toBe(
      'api/donors/me',
    );
    expect(
      Reflect.getMetadata(PRESERVE_BILINGUAL_RESPONSE, DonorMobileController),
    ).toBeUndefined();
  });

  it('protects mobile donor history with JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DonorMobileController.prototype.getMyHistory,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('passes authenticated user and language to the mobile history service', async () => {
    donorService.getMyHistory.mockResolvedValue({ data: { years: [] } });
    const req = {
      user: {
        id: 7,
        type: 'DONOR',
      },
    } as any;

    await mobileController.getMyHistory(req, 'en');

    expect(donorService.getMyHistory).toHaveBeenCalledWith(req.user, 'en');
  });
});
