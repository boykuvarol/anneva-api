import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DatingMethod,
  PregnancyStatus,
  Prisma,
  type Pregnancy,
  type User,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePregnancyDto } from './dto/create-pregnancy.dto';
import { EndPregnancyDto } from './dto/end-pregnancy.dto';
import { UpdatePregnancyDto } from './dto/update-pregnancy.dto';
import {
  PregnancyCalculation,
  PregnancyCalculationService,
} from './pregnancy-calculation.service';

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const oneActivePregnancyIndexName = 'Pregnancy_one_active_per_user_key';

type PregnancyResponse = {
  id: string;
  datingMethod: DatingMethod;
  lastMenstrualPeriod: Date | null;
  cycleLength: number;
  doctorDueDate: Date | null;
  status: PregnancyStatus;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
} & PregnancyCalculation;

type PregnancyDraft = {
  datingMethod: DatingMethod;
  lastMenstrualPeriod?: string | null;
  cycleLength?: number;
  doctorDueDate?: string | null;
};

@Injectable()
export class PregnanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pregnancyCalculationService: PregnancyCalculationService,
  ) {}

  async create(
    user: User,
    dto: CreatePregnancyDto,
  ): Promise<PregnancyResponse> {
    const data = this.toCanonicalCreateData(dto);

    try {
      const pregnancy = await this.prisma.$transaction(async (tx) => {
        const activePregnancy = await tx.pregnancy.findFirst({
          where: {
            userId: user.id,
            status: PregnancyStatus.active,
          },
        });

        if (activePregnancy) {
          throw new ConflictException('Aktif gebelik kaydı zaten mevcut.');
        }

        const createdPregnancy = await tx.pregnancy.create({
          data: {
            ...data,
            userId: user.id,
          },
        });

        await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            onboardingCompleted: true,
          },
        });

        return createdPregnancy;
      });

      return this.toResponse(pregnancy);
    } catch (error) {
      if (this.isOneActivePregnancyConflict(error)) {
        throw new ConflictException('Aktif gebelik kaydı zaten mevcut.');
      }

      throw error;
    }
  }

  async getCurrent(user: User): Promise<PregnancyResponse> {
    const pregnancy = await this.findCurrentPregnancy(user.id);
    return this.toResponse(pregnancy);
  }

  async updateCurrent(
    user: User,
    dto: UpdatePregnancyDto,
  ): Promise<PregnancyResponse> {
    const currentPregnancy = await this.findCurrentPregnancy(user.id);
    const finalDraft = this.buildUpdateDraft(currentPregnancy, dto);
    const data = this.toCanonicalUpdateData(finalDraft, dto);

    const updatedPregnancy = await this.prisma.pregnancy.update({
      where: {
        id: currentPregnancy.id,
        userId: user.id,
        status: PregnancyStatus.active,
      },
      data,
    });

    return this.toResponse(updatedPregnancy);
  }

  async endCurrent(
    user: User,
    dto: EndPregnancyDto,
  ): Promise<PregnancyResponse> {
    const currentPregnancy = await this.findCurrentPregnancy(user.id);
    // Pregnancy dating fields are normalized to UTC date-only values, but
    // endedAt is an event timestamp so historical completion time is preserved.
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();

    const updatedPregnancy = await this.prisma.pregnancy.update({
      where: {
        id: currentPregnancy.id,
        userId: user.id,
        status: PregnancyStatus.active,
      },
      data: {
        status: dto.status,
        endedAt,
      },
    });

    return this.toResponse(updatedPregnancy);
  }

  private async findCurrentPregnancy(userId: string): Promise<Pregnancy> {
    const pregnancy = await this.prisma.pregnancy.findFirst({
      where: {
        userId,
        status: PregnancyStatus.active,
      },
    });

    if (!pregnancy) {
      throw new NotFoundException('Aktif gebelik kaydı bulunamadı.');
    }

    return pregnancy;
  }

  private toCanonicalCreateData(dto: CreatePregnancyDto) {
    this.validateCreateDatingFields(dto);
    return this.toCanonicalData({
      datingMethod: dto.datingMethod,
      lastMenstrualPeriod: dto.lastMenstrualPeriod,
      cycleLength: dto.cycleLength,
      doctorDueDate: dto.doctorDueDate,
    });
  }

  private buildUpdateDraft(
    currentPregnancy: Pregnancy,
    dto: UpdatePregnancyDto,
  ): PregnancyDraft {
    return {
      datingMethod: dto.datingMethod ?? currentPregnancy.datingMethod,
      lastMenstrualPeriod:
        dto.lastMenstrualPeriod === undefined
          ? currentPregnancy.lastMenstrualPeriod?.toISOString()
          : dto.lastMenstrualPeriod,
      cycleLength: dto.cycleLength ?? currentPregnancy.cycleLength,
      doctorDueDate:
        dto.doctorDueDate === undefined
          ? currentPregnancy.doctorDueDate?.toISOString()
          : dto.doctorDueDate,
    };
  }

  private toCanonicalUpdateData(
    finalDraft: PregnancyDraft,
    dto: UpdatePregnancyDto,
  ) {
    this.validatePatchDatingFields(finalDraft, dto);
    return this.toCanonicalData(finalDraft);
  }

  private toCanonicalData(draft: PregnancyDraft) {
    if (draft.datingMethod === DatingMethod.lmp) {
      if (!draft.lastMenstrualPeriod) {
        throw new BadRequestException('Son adet tarihi gerekli.');
      }

      return {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: this.parseLmpDate(draft.lastMenstrualPeriod),
        cycleLength: draft.cycleLength ?? 28,
        doctorDueDate: null,
      };
    }

    if (!draft.doctorDueDate) {
      throw new BadRequestException('Doktor doğum tarihi gerekli.');
    }

    return {
      datingMethod: DatingMethod.doctorDueDate,
      lastMenstrualPeriod: null,
      cycleLength: 28,
      doctorDueDate: this.parseDoctorDueDate(draft.doctorDueDate),
    };
  }

  private validateCreateDatingFields(dto: CreatePregnancyDto): void {
    if (dto.datingMethod === DatingMethod.lmp) {
      if (!dto.lastMenstrualPeriod) {
        throw new BadRequestException('Son adet tarihi gerekli.');
      }

      if (dto.doctorDueDate) {
        throw new BadRequestException(
          'Son adet tarihi yöntemi için doktor doğum tarihi gönderilmemeli.',
        );
      }

      return;
    }

    if (!dto.doctorDueDate) {
      throw new BadRequestException('Doktor doğum tarihi gerekli.');
    }

    if (dto.lastMenstrualPeriod) {
      throw new BadRequestException(
        'Doktor doğum tarihi yöntemi için son adet tarihi gönderilmemeli.',
      );
    }

    if (dto.cycleLength !== undefined) {
      throw new BadRequestException(
        'Doktor doğum tarihi yöntemi için döngü uzunluğu gönderilmemeli.',
      );
    }
  }

  private validatePatchDatingFields(
    finalDraft: PregnancyDraft,
    dto: UpdatePregnancyDto,
  ): void {
    if (finalDraft.datingMethod === DatingMethod.lmp) {
      if (dto.doctorDueDate) {
        throw new BadRequestException(
          'Son adet tarihi yöntemi için doktor doğum tarihi gönderilmemeli.',
        );
      }

      if (!finalDraft.lastMenstrualPeriod) {
        throw new BadRequestException('Son adet tarihi gerekli.');
      }

      return;
    }

    if (dto.lastMenstrualPeriod) {
      throw new BadRequestException(
        'Doktor doğum tarihi yöntemi için son adet tarihi gönderilmemeli.',
      );
    }

    if (dto.cycleLength !== undefined) {
      throw new BadRequestException(
        'Doktor doğum tarihi yöntemi için döngü uzunluğu gönderilmemeli.',
      );
    }

    if (!finalDraft.doctorDueDate) {
      throw new BadRequestException('Doktor doğum tarihi gerekli.');
    }
  }

  private isOneActivePregnancyConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    if (typeof target === 'string') {
      return target === oneActivePregnancyIndexName;
    }

    if (Array.isArray(target)) {
      return target.includes(oneActivePregnancyIndexName);
    }

    return true;
  }

  private parseLmpDate(value: string): Date {
    const date = this.pregnancyCalculationService.parseIsoDateOnly(value);
    const daysFromToday = this.diffFromToday(date);

    if (daysFromToday > 0 || daysFromToday < -336) {
      throw new BadRequestException(
        'Son adet tarihi beklenen aralığın dışında.',
      );
    }

    return date;
  }

  private parseDoctorDueDate(value: string): Date {
    const date = this.pregnancyCalculationService.parseIsoDateOnly(value);
    const daysFromToday = this.diffFromToday(date);

    if (daysFromToday < -42 || daysFromToday > 336) {
      throw new BadRequestException(
        'Doktor doğum tarihi beklenen aralığın dışında.',
      );
    }

    return date;
  }

  private diffFromToday(date: Date): number {
    const today = this.pregnancyCalculationService.toUtcDateOnly(new Date());
    return Math.floor((date.getTime() - today.getTime()) / millisecondsPerDay);
  }

  private toResponse(pregnancy: Pregnancy): PregnancyResponse {
    return {
      id: pregnancy.id,
      datingMethod: pregnancy.datingMethod,
      lastMenstrualPeriod: pregnancy.lastMenstrualPeriod,
      cycleLength: pregnancy.cycleLength,
      doctorDueDate: pregnancy.doctorDueDate,
      status: pregnancy.status,
      startedAt: pregnancy.startedAt,
      endedAt: pregnancy.endedAt,
      createdAt: pregnancy.createdAt,
      updatedAt: pregnancy.updatedAt,
      ...this.pregnancyCalculationService.calculate(pregnancy),
    };
  }
}
