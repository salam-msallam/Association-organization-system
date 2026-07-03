import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrphanDto } from './dto/create-orphan.dto';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class OrphanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateOrphanDto, lang: string) {
    if (!dto.FamilyStatement) {
      throw new BadRequestException(
        this.i18n.t('orphan.FAMILY_STATEMENT_REQUIRED', { lang }),
      );    
    }

    const orphan = await this.prisma.orphan.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        fatherName: dto.fatherName,
        motherName: dto.motherName,
        birthOfDate: new Date(dto.birthOfDate),
        gender: dto.gender,

        class: this.parseJson(dto.class, 'class', lang),
        Diseases: this.parseJson(dto.Diseases, 'Diseases', lang),
        currentAddress: this.parseJson(dto.currentAddress, 'currentAddress', lang),
        previousAddress: this.parseJson(dto.previousAddress, 'previousAddress', lang),
        talent: this.parseJson(dto.talent, 'talent', lang),

        FamilyStatement: dto.FamilyStatement,
        brotherAndSisterNumber: Number(dto.brotherAndSisterNumber),
        guardianName: dto.guardianName,
        guaranteedPhone: dto.guaranteedPhone,
        bodySize: Number(dto.bodySize),
        shoesSize: Number(dto.shoesSize),
        ...(dto.isSupported !== undefined && { isSupported: dto.isSupported }),
      },
    });

    return {
      message: this.i18n.t('orphan.CREATE_SUCCESS', { lang }),
      data: orphan,
    };
  }

  private parseJson(value: any, fieldName: string, lang: string) {
    if (typeof value === 'object') return value;

    try {
      return JSON.parse(value);
    } catch {
      throw new BadRequestException(
        this.i18n.t('orphan.INVALID_JSON_FIELD', {
          lang,
          args: { field: fieldName },
        }),
      );
    }
  }
}
