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
    priority: 3,
    isSupported: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      orphan: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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
    expect(prisma.orphan.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 10,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('filters the paginated list by priority', async () => {
    prisma.orphan.findMany.mockResolvedValue([{ ...orphan, priority: 5 }]);
    prisma.orphan.count.mockResolvedValue(1);

    await service.findAll(1, 10, undefined, 'en', 5);

    expect(prisma.orphan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { priority: 5 } }),
    );
    expect(prisma.orphan.count).toHaveBeenCalledWith({
      where: { priority: 5 },
    });
  });

  it('returns bilingual JSON fields in orphan details', async () => {
    prisma.orphan.findUnique.mockResolvedValue({
      ...orphan,
      sponsorships: [],
    });

    const result = await service.findOne(1, 'ar');

    expect(result).toEqual({
      message: 'orphan.FETCH_ONE_SUCCESS:ar',
      data: {
        ...orphan,
        sponsorshipId: null,
        sponsorshipIds: [],
        activeSponsorsCount: 0,
      },
    });
    expect(prisma.orphan.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        sponsorships: {
          where: { status: 'ACCEPTED' },
          select: { id: true },
          orderBy: { id: 'desc' },
        },
      },
    });
    expect(i18n.t).toHaveBeenCalledWith('orphan.FETCH_ONE_SUCCESS', {
      lang: 'ar',
    });
  });

  it('returns all accepted sponsorship ids for a supported orphan', async () => {
    prisma.orphan.findUnique.mockResolvedValue({
      ...orphan,
      isSupported: true,
      sponsorships: [{ id: 17 }, { id: 12 }],
    });

    const result = await service.findOne(1, 'en');

    expect(result.data).toEqual({
      ...orphan,
      isSupported: true,
      sponsorshipId: 17,
      sponsorshipIds: [17, 12],
      activeSponsorsCount: 2,
    });
    expect(result.data).not.toHaveProperty('sponsorships');
  });

  it('returns bilingual JSON fields after creating an orphan', async () => {
    prisma.orphan.create.mockResolvedValue(orphan);

    const result = await service.create(
      {
        firstName: orphan.firstName,
        lastName: orphan.lastName,
        fatherName: orphan.fatherName,
        motherName: orphan.motherName,
        birthOfDate: '2015-04-12',
        gender: orphan.gender,
        class: JSON.stringify(orphan.class),
        Diseases: JSON.stringify(orphan.Diseases),
        currentAddress: JSON.stringify(orphan.currentAddress),
        previousAddress: JSON.stringify(orphan.previousAddress),
        talent: JSON.stringify(orphan.talent),
        FamilyStatement: orphan.FamilyStatement,
        brotherAndSisterNumber: orphan.brotherAndSisterNumber,
        guardianName: orphan.guardianName,
        guaranteedPhone: orphan.guaranteedPhone,
        bodySize: orphan.bodySize,
        shoesSize: orphan.shoesSize,
        isSupported: orphan.isSupported,
        priority: 5,
      },
      'en',
    );

    expect(prisma.orphan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          class: orphan.class,
          Diseases: orphan.Diseases,
          currentAddress: orphan.currentAddress,
          previousAddress: orphan.previousAddress,
          talent: orphan.talent,
          priority: 5,
        }),
      }),
    );
    expect(result).toEqual({
      message: 'orphan.CREATE_SUCCESS:en',
      data: orphan,
    });
  });

  it('returns bilingual JSON fields after updating an orphan', async () => {
    const updatedOrphan = {
      ...orphan,
      class: { ar: 'الصف الخامس', en: 'Fifth grade' },
      currentAddress: { ar: 'حلب', en: 'Aleppo' },
    };
    prisma.orphan.findUnique.mockResolvedValue(orphan);
    prisma.orphan.update.mockResolvedValue(updatedOrphan);

    const result = await service.update(
      1,
      {
        class: JSON.stringify(updatedOrphan.class),
        currentAddress: JSON.stringify(updatedOrphan.currentAddress),
        priority: 4,
      },
      undefined,
      'en',
    );

    expect(prisma.orphan.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        class: updatedOrphan.class,
        currentAddress: updatedOrphan.currentAddress,
        priority: 4,
      },
    });
    expect(result).toEqual({
      message: 'orphan.UPDATE_SUCCESS:en',
      data: updatedOrphan,
    });
    expect(result.data.class).toEqual(updatedOrphan.class);
    expect(result.data.currentAddress).toEqual(updatedOrphan.currentAddress);
  });
});
