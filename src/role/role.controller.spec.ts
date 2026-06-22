import { Test, TestingModule } from '@nestjs/testing';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

describe('RoleController', () => {
  let controller: RoleController;
  const prismaMock = {
    role: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [
        RoleService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: I18nService,
          useValue: {
            t: jest.fn((key: string) => key),
          },
        },
      ],
    }).compile();

    controller = module.get<RoleController>(RoleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
