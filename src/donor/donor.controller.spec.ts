import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PRESERVE_BILINGUAL_RESPONSE } from '../decorators/preserve-bilingual-response.decorator';
import { DonorController } from './donor.controller';

describe('DonorController', () => {
  let donorService: any;
  let controller: DonorController;

  beforeEach(() => {
    donorService = {
      findAll: jest.fn(),
      getHistory: jest.fn(),
    };
    controller = new DonorController(donorService);
  });

  it('uses the admin donors route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DonorController)).toBe(
      'api/admin/donors',
    );
  });

  it('preserves bilingual JSON fields for donor history responses', () => {
    expect(Reflect.getMetadata(PRESERVE_BILINGUAL_RESPONSE, DonorController)).toBe(
      true,
    );
  });

  it('protects donor routes with class-level guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DonorController)).toHaveLength(3);
  });

  it('requires read access to the Donor subject', () => {
    expect(
      Reflect.getMetadata(
        'check_ability',
        DonorController.prototype.findAll,
      ),
    ).toEqual({ action: 'read', subject: 'Donor' });
    expect(
      Reflect.getMetadata(
        'check_ability',
        DonorController.prototype.getHistory,
      ),
    ).toEqual({ action: 'read', subject: 'Donor' });
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
});
