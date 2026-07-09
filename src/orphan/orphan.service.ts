import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrphanDto } from './dto/create-orphan.dto';
import { UpdateOrphanDto } from './dto/update-orphan.dto';

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

    const orphan = await this.handleUniqueConstraint(
      this.prisma.orphan.create({
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
      }),
      lang,
    );

    return {
      message: this.i18n.t('orphan.CREATE_SUCCESS', { lang }),
      data: this.localizeOrphan(orphan, lang),
    };
  }

  async findAll(page: number = 1, limit: number = 10, isSupported?: boolean, lang = 'ar') {
    const skip = (page - 1) * limit;
    const where = isSupported === undefined ? {} : { isSupported };

    const [orphans, totalCount] = await Promise.all([
      this.prisma.orphan.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          id: 'desc',
        },
      }),
      this.prisma.orphan.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: orphans.map((orphan) => this.localizeOrphan(orphan, lang)),
      meta: {
        totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number, lang = 'ar') {
    const orphan = await this.prisma.orphan.findUnique({
      where: { id },
    });

    if (!orphan) {
      throw new BadRequestException(this.i18n.t('orphan.ORPHAN_NOT_FOUND', { lang }));
    }

    return {
      message: this.i18n.t('orphan.FETCH_ONE_SUCCESS', { lang }),
      data: this.localizeOrphan(orphan, lang),
    };
  }

  async update(
    id: number,
    dto: UpdateOrphanDto,
    familyStatementPath?: string,
    lang = 'ar',
  ) {
    await this.findOne(id, lang);

    const data: any = {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.fatherName && { fatherName: dto.fatherName }),
      ...(dto.motherName && { motherName: dto.motherName }),
      ...(dto.birthOfDate && { birthOfDate: new Date(dto.birthOfDate) }),
      ...(dto.gender && { gender: dto.gender }),
      ...(dto.class !== undefined && {
        class: this.parseJson(dto.class, 'class', lang),
      }),
      ...(dto.Diseases !== undefined && {
        Diseases: this.parseJson(dto.Diseases, 'Diseases', lang),
      }),
      ...(dto.currentAddress !== undefined && {
        currentAddress: this.parseJson(dto.currentAddress, 'currentAddress', lang),
      }),
      ...(dto.previousAddress !== undefined && {
        previousAddress: this.parseJson(dto.previousAddress, 'previousAddress', lang),
      }),
      ...(dto.talent !== undefined && {
        talent: this.parseJson(dto.talent, 'talent', lang),
      }),
      ...(familyStatementPath && { FamilyStatement: familyStatementPath }),
      ...(dto.brotherAndSisterNumber !== undefined && {
        brotherAndSisterNumber: Number(dto.brotherAndSisterNumber),
      }),
      ...(dto.guardianName && { guardianName: dto.guardianName }),
      ...(dto.guaranteedPhone && { guaranteedPhone: dto.guaranteedPhone }),
      ...(dto.bodySize !== undefined && { bodySize: Number(dto.bodySize) }),
      ...(dto.shoesSize !== undefined && { shoesSize: Number(dto.shoesSize) }),
      ...(dto.isSupported !== undefined && { isSupported: dto.isSupported }),
    };

    const orphan = await this.handleUniqueConstraint(
      this.prisma.orphan.update({
        where: { id },
        data,
      }),
      lang,
    );

    return {
      message: this.i18n.t('orphan.UPDATE_SUCCESS', { lang }),
      data: this.localizeOrphan(orphan, lang),
    };
  }

  async remove(id: number, lang = 'ar') {
    await this.findOne(id, lang);

    try {
      await this.prisma.orphan.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          this.i18n.t('orphan.DELETE_BLOCKED_BY_SPONSORSHIP', { lang }),
        );
      }

      throw error;
    }

    return {
      success: true,
      message: this.i18n.t('orphan.DELETE_SUCCESS', { lang }),
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

  private async handleUniqueConstraint<T>(operation: Promise<T>, lang: string): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(this.i18n.t('orphan.ORPHAN_ALREADY_EXISTS', { lang }));
      }

      throw error;
    }
  }

  private localizeOrphan(orphan: any, lang: string) {
    if (!orphan) return orphan;

    return {
      ...orphan,
      class: this.localizeJsonValue(orphan.class, lang),
      Diseases: this.localizeJsonValue(orphan.Diseases, lang),
      currentAddress: this.localizeJsonValue(orphan.currentAddress, lang),
      previousAddress: this.localizeJsonValue(orphan.previousAddress, lang),
      talent: this.localizeJsonValue(orphan.talent, lang),
    };
  }

  private localizeJsonValue(value: any, lang: string): any {
    if (!value || typeof value !== 'object') return value;

    if (!Array.isArray(value) && ('ar' in value || 'en' in value)) {
      return value[lang] ?? value.ar ?? value.en;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.localizeJsonValue(item, lang));
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        this.localizeJsonValue(item, lang),
      ]),
    );
  }
}
