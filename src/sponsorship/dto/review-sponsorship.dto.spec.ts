import { Status } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReviewSponsorshipDto } from './review-sponsorship.dto';

describe('ReviewSponsorshipDto', () => {
  it('accepts multipart fields for an accepted sponsorship', async () => {
    const dto = plainToInstance(ReviewSponsorshipDto, {
      status: 'accepted',
      orphanId: '3',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(Status.ACCEPTED);
    expect(dto.orphanId).toBe(3);
  });

  it('requires orphanId only when accepting', async () => {
    const dto = plainToInstance(ReviewSponsorshipDto, {
      status: Status.ACCEPTED,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'orphanId')).toBe(true);
  });

  it('parses and validates a bilingual rejection reason from multipart JSON', async () => {
    const dto = plainToInstance(ReviewSponsorshipDto, {
      status: 'rejected',
      rejectionReason: JSON.stringify({
        ar: 'لا يوجد يتيم مناسب حالياً',
        en: 'No suitable orphan is currently available',
      }),
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(Status.REJECTED);
    expect(dto.rejectionReason).toEqual({
      ar: 'لا يوجد يتيم مناسب حالياً',
      en: 'No suitable orphan is currently available',
    });
  });

  it('requires rejectionReason only when rejecting', async () => {
    const dto = plainToInstance(ReviewSponsorshipDto, {
      status: Status.REJECTED,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'rejectionReason')).toBe(
      true,
    );
  });
});
