import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PublicDonorAidRequestsController } from './public-donor-aid-requests.controller';

describe('PublicDonorAidRequestsController', () => {
  let requestAidService: any;
  let controller: PublicDonorAidRequestsController;

  beforeEach(() => {
    requestAidService = {
      getPublicAidRequests: jest.fn(),
      getPublicAidRequestById: jest.fn(),
    };
    controller = new PublicDonorAidRequestsController(requestAidService);
  });

  it('uses the donor public aid requests route prefix', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, PublicDonorAidRequestsController),
    ).toBe('donor/public/aid-requests');
  });

  it('does not apply guard metadata to the public controller or handlers', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PublicDonorAidRequestsController),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PublicDonorAidRequestsController.prototype.findAll,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PublicDonorAidRequestsController.prototype.findOne,
      ),
    ).toBeUndefined();
  });

  it('passes an optional positive categoryId to the public list service', async () => {
    requestAidService.getPublicAidRequests.mockResolvedValue([]);

    await expect(controller.findAll('3', 'en')).resolves.toEqual([]);

    expect(requestAidService.getPublicAidRequests).toHaveBeenCalledWith(
      3,
      'en',
    );
  });

  it('passes undefined categoryId when the query is omitted', async () => {
    requestAidService.getPublicAidRequests.mockResolvedValue([]);

    await controller.findAll(undefined, 'ar');

    expect(requestAidService.getPublicAidRequests).toHaveBeenCalledWith(
      undefined,
      'ar',
    );
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'rejects invalid categoryId %s',
    (categoryId) => {
      expect(() => controller.findAll(categoryId, 'en')).toThrow(
        BadRequestException,
      );
      expect(requestAidService.getPublicAidRequests).not.toHaveBeenCalled();
    },
  );

  it('passes the request id and language to the public detail service', async () => {
    requestAidService.getPublicAidRequestById.mockResolvedValue({
      image: null,
      title: 'Urgent surgery',
      description: 'Reviewed request description',
      totalCost: '2500',
      paidAmount: '1250',
      remainingAmount: '1250',
      completionPercentage: 50,
      isUrgent: true,
    });

    await controller.findOne('13', 'en');

    expect(requestAidService.getPublicAidRequestById).toHaveBeenCalledWith(
      '13',
      'en',
    );
  });
});
