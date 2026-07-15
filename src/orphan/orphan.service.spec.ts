import { Gender } from '@prisma/client';
import { OrphanService } from './orphan.service';

describe('OrphanService read responses', () => {
  let service: OrphanService;
  let prisma: any;
  let i18n: any;

  const orphan = {
    id: 1,
    firstName: 'Ahmad',
    lastName: 'Hassan',
    fatherName: 'Mohammad',
    motherName: 'Fatima',
    birthOfDate: new Date('2015-04-12T00:00:00.000Z'),
    gender: Gender.MALE,
    class: { ar: 'الصف الرابع', en: 'Fourth grade' },
    Diseases: { ar: 'لا توجد أمراض', en: 'No diseases' },
    FamilyStatement: 'uploads/orphans/family-statement.pdf',
    brotherAndSisterNumber: 3,
    guardianName: 'Mahmoud Hassan',
    guaranteedPhone: '+963933123456',
    bodySize: 130,
    shoesSize: 34,
    currentAddress: { ar: 'دمشق', en: 'Damascus' },
    previousAddress: { ar: 'حمص', en: 'Homs' },
    talent: { ar: 'الرسم', en: 'Drawing' },
    isSupported: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      orphan: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    i18n = {
      t: jest.fn((key, options) => `${key}:${options?.lang ?? 'ar'}`),
    };
    service = new OrphanService(prisma, i18n);
  });

  it('returns bilingual JSON fields in the paginated list', async () => {
    prisma.orphan.findMany.mockResolvedValue([orphan]);
    prisma.orphan.count.mockResolvedValue(1);

    const result = await service.findAll(1, 10, undefined, 'en');

    expect(result.data[0]).toEqual(orphan);
    expect(result.data[0].class).toEqual(orphan.class);
    expect(result.data[0].Diseases).toEqual(orphan.Diseases);
    expect(result.data[0].currentAddress).toEqual(orphan.currentAddress);
    expect(result.data[0].previousAddress).toEqual(orphan.previousAddress);
    expect(result.data[0].talent).toEqual(orphan.talent);
  });

  it('returns bilingual JSON fields in orphan details', async () => {
    prisma.orphan.findUnique.mockResolvedValue(orphan);

    const result = await service.findOne(1, 'ar');

    expect(result).toEqual({
      message: 'orphan.FETCH_ONE_SUCCESS:ar',
      data: orphan,
    });
    expect(i18n.t).toHaveBeenCalledWith('orphan.FETCH_ONE_SUCCESS', {
      lang: 'ar',
    });
  });
});
