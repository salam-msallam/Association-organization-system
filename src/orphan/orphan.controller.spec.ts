import { BadRequestException } from '@nestjs/common';
import { OrphanController } from './orphan.controller';

describe('OrphanController priority filter', () => {
  let controller: OrphanController;
  let orphanService: { findAll: jest.Mock };

  beforeEach(() => {
    orphanService = { findAll: jest.fn() };
    const i18n = {
      t: jest.fn((key: string) => key),
    };

    controller = new OrphanController(orphanService as never, i18n as never);
  });

  it('passes a valid priority filter to the service', () => {
    controller.findAll('2', '10', 'false', '5', 'en');

    expect(orphanService.findAll).toHaveBeenCalledWith(2, 10, false, 'en', 5);
  });

  it.each(['0', '6', '2.5', 'invalid'])('rejects priority %p', (priority) => {
    expect(() =>
      controller.findAll('1', '10', undefined, priority, 'en'),
    ).toThrow(BadRequestException);
    expect(orphanService.findAll).not.toHaveBeenCalled();
  });
});
