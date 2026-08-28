import {
  BadRequestException,
  ConflictException,
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
import { PregnancyCalculationService } from './pregnancy-calculation.service';
import { PregnanciesService } from './pregnancies.service';

type PregnancyDelegateMock = {
  findFirst: jest.Mock<Promise<Pregnancy | null>, [unknown]>;
  create: jest.Mock<Promise<Pregnancy>, [unknown]>;
  update: jest.Mock<Promise<Pregnancy>, [unknown]>;
};

type UserDelegateMock = {
  update: jest.Mock<Promise<User>, [unknown]>;
};

type PrismaMock = {
  pregnancy: PregnancyDelegateMock;
  user: UserDelegateMock;
  $transaction: jest.Mock<
    Promise<Pregnancy>,
    [(tx: PrismaMock) => Promise<Pregnancy>]
  >;
};

describe('PregnanciesService', () => {
  let service: PregnanciesService;
  let prisma: PrismaMock;
  let currentUser: User;

  beforeEach(() => {
    currentUser = createUser();
    prisma = {
      pregnancy: {
        findFirst: jest.fn<Promise<Pregnancy | null>, [unknown]>(),
        create: jest.fn<Promise<Pregnancy>, [unknown]>(),
        update: jest.fn<Promise<Pregnancy>, [unknown]>(),
      },
      user: {
        update: jest.fn<Promise<User>, [unknown]>(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    service = new PregnanciesService(
      prisma as unknown as PrismaService,
      new PregnancyCalculationService(),
    );
  });

  it('creates an active pregnancy from LMP and marks onboarding completed', async () => {
    const pregnancy = createPregnancy({
      lastMenstrualPeriod: daysFromNow(-28),
      cycleLength: 30,
    });

    prisma.pregnancy.findFirst.mockResolvedValueOnce(null);
    prisma.pregnancy.create.mockResolvedValueOnce(pregnancy);
    prisma.user.update.mockResolvedValueOnce(
      createUser({ onboardingCompleted: true }),
    );

    await expect(
      service.create(currentUser, {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: pregnancy.lastMenstrualPeriod?.toISOString(),
        cycleLength: 30,
      }),
    ).resolves.toMatchObject({
      id: pregnancy.id,
      datingMethod: DatingMethod.lmp,
      cycleLength: 30,
    });

    expect(prisma.pregnancy.findFirst).toHaveBeenCalledWith({
      where: {
        userId: currentUser.id,
        status: PregnancyStatus.active,
      },
    });
    expect(prisma.pregnancy.create).toHaveBeenCalledWith({
      data: {
        userId: currentUser.id,
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: pregnancy.lastMenstrualPeriod,
        cycleLength: 30,
        doctorDueDate: null,
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: currentUser.id,
      },
      data: {
        onboardingCompleted: true,
      },
    });
  });

  it('creates an active pregnancy from doctor due date', async () => {
    const pregnancy = createPregnancy({
      datingMethod: DatingMethod.doctorDueDate,
      lastMenstrualPeriod: null,
      doctorDueDate: daysFromNow(190),
    });

    prisma.pregnancy.findFirst.mockResolvedValueOnce(null);
    prisma.pregnancy.create.mockResolvedValueOnce(pregnancy);
    prisma.user.update.mockResolvedValueOnce(
      createUser({ onboardingCompleted: true }),
    );

    await service.create(currentUser, {
      datingMethod: DatingMethod.doctorDueDate,
      doctorDueDate: pregnancy.doctorDueDate?.toISOString(),
    });

    expect(prisma.pregnancy.create).toHaveBeenCalledWith({
      data: {
        userId: currentUser.id,
        datingMethod: DatingMethod.doctorDueDate,
        lastMenstrualPeriod: null,
        cycleLength: 28,
        doctorDueDate: pregnancy.doctorDueDate,
      },
    });
  });

  it('rejects a second active pregnancy in the friendly service pre-check', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(createPregnancy());

    await expect(
      service.create(currentUser, {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: daysFromNow(-20).toISOString(),
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.pregnancy.create).not.toHaveBeenCalled();
  });

  it('maps a raced database unique conflict to 409', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
        meta: {
          target: 'Pregnancy_one_active_per_user_key',
        },
      }),
    );

    await expect(
      service.create(currentUser, {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: daysFromNow(-20).toISOString(),
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 404 when the current user has no active pregnancy', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(null);

    await expect(service.getCurrent(currentUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('does not read another user pregnancy', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getCurrent(createUser({ id: 'other-user-id' })),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.pregnancy.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'other-user-id',
        status: PregnancyStatus.active,
      },
    });
  });

  it('updates only the current user active pregnancy', async () => {
    const currentPregnancy = createPregnancy();
    const updatedPregnancy = createPregnancy({ cycleLength: 31 });

    prisma.pregnancy.findFirst.mockResolvedValueOnce(currentPregnancy);
    prisma.pregnancy.update.mockResolvedValueOnce(updatedPregnancy);

    await service.updateCurrent(currentUser, { cycleLength: 31 });

    expect(prisma.pregnancy.update).toHaveBeenCalledWith({
      where: {
        id: currentPregnancy.id,
        userId: currentUser.id,
        status: PregnancyStatus.active,
      },
      data: {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: currentPregnancy.lastMenstrualPeriod,
        cycleLength: 31,
        doctorDueDate: null,
      },
    });
  });

  it('does not update another user pregnancy', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateCurrent(createUser({ id: 'other-user-id' }), {
        cycleLength: 31,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.pregnancy.update).not.toHaveBeenCalled();
  });

  it('switches LMP to doctor due date and clears obsolete fields', async () => {
    const currentPregnancy = createPregnancy();
    const doctorDueDate = daysFromNow(190);
    const updatedPregnancy = createPregnancy({
      datingMethod: DatingMethod.doctorDueDate,
      lastMenstrualPeriod: null,
      cycleLength: 28,
      doctorDueDate,
    });

    prisma.pregnancy.findFirst.mockResolvedValueOnce(currentPregnancy);
    prisma.pregnancy.update.mockResolvedValueOnce(updatedPregnancy);

    await service.updateCurrent(currentUser, {
      datingMethod: DatingMethod.doctorDueDate,
      doctorDueDate: doctorDueDate.toISOString(),
    });

    expect(prisma.pregnancy.update).toHaveBeenCalledWith({
      where: {
        id: currentPregnancy.id,
        userId: currentUser.id,
        status: PregnancyStatus.active,
      },
      data: {
        datingMethod: DatingMethod.doctorDueDate,
        lastMenstrualPeriod: null,
        cycleLength: 28,
        doctorDueDate,
      },
    });
  });

  it('switches doctor due date to LMP and clears obsolete fields', async () => {
    const currentPregnancy = createPregnancy({
      datingMethod: DatingMethod.doctorDueDate,
      lastMenstrualPeriod: null,
      doctorDueDate: daysFromNow(190),
    });
    const lastMenstrualPeriod = daysFromNow(-40);
    const updatedPregnancy = createPregnancy({
      datingMethod: DatingMethod.lmp,
      lastMenstrualPeriod,
      doctorDueDate: null,
    });

    prisma.pregnancy.findFirst.mockResolvedValueOnce(currentPregnancy);
    prisma.pregnancy.update.mockResolvedValueOnce(updatedPregnancy);

    await service.updateCurrent(currentUser, {
      datingMethod: DatingMethod.lmp,
      lastMenstrualPeriod: lastMenstrualPeriod.toISOString(),
    });

    expect(prisma.pregnancy.update).toHaveBeenCalledWith({
      where: {
        id: currentPregnancy.id,
        userId: currentUser.id,
        status: PregnancyStatus.active,
      },
      data: {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod,
        cycleLength: 28,
        doctorDueDate: null,
      },
    });
  });

  it('ends only the current user active pregnancy and preserves endedAt timestamp', async () => {
    const currentPregnancy = createPregnancy();
    const endedAt = new Date('2026-08-28T13:45:30.123Z');
    const endedPregnancy = createPregnancy({
      status: PregnancyStatus.completed,
      endedAt,
    });

    prisma.pregnancy.findFirst.mockResolvedValueOnce(currentPregnancy);
    prisma.pregnancy.update.mockResolvedValueOnce(endedPregnancy);

    await service.endCurrent(currentUser, {
      status: PregnancyStatus.completed,
      endedAt: endedAt.toISOString(),
    });

    expect(prisma.pregnancy.update).toHaveBeenCalledWith({
      where: {
        id: currentPregnancy.id,
        userId: currentUser.id,
        status: PregnancyStatus.active,
      },
      data: {
        status: PregnancyStatus.completed,
        endedAt,
      },
    });
  });

  it('does not end another user pregnancy', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.endCurrent(createUser({ id: 'other-user-id' }), {
        status: PregnancyStatus.loss,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.pregnancy.update).not.toHaveBeenCalled();
  });

  it('rejects LMP create with doctor due date', async () => {
    await expect(
      service.create(currentUser, {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: daysFromNow(-20).toISOString(),
        doctorDueDate: daysFromNow(260).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects doctor due date create with LMP', async () => {
    await expect(
      service.create(currentUser, {
        datingMethod: DatingMethod.doctorDueDate,
        lastMenstrualPeriod: daysFromNow(-20).toISOString(),
        doctorDueDate: daysFromNow(260).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects doctor due date create with cycle length', async () => {
    await expect(
      service.create(currentUser, {
        datingMethod: DatingMethod.doctorDueDate,
        doctorDueDate: daysFromNow(260).toISOString(),
        cycleLength: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects PATCH LMP with doctor due date input', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(createPregnancy());

    await expect(
      service.updateCurrent(currentUser, {
        doctorDueDate: daysFromNow(260).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects PATCH doctor due date with LMP input', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(
      createPregnancy({
        datingMethod: DatingMethod.doctorDueDate,
        lastMenstrualPeriod: null,
        doctorDueDate: daysFromNow(190),
      }),
    );

    await expect(
      service.updateCurrent(currentUser, {
        lastMenstrualPeriod: daysFromNow(-20).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects PATCH doctor due date with cycle length input', async () => {
    prisma.pregnancy.findFirst.mockResolvedValueOnce(
      createPregnancy({
        datingMethod: DatingMethod.doctorDueDate,
        lastMenstrualPeriod: null,
        doctorDueDate: daysFromNow(190),
      }),
    );

    await expect(
      service.updateCurrent(currentUser, { cycleLength: 30 }),
    ).rejects.toThrow(BadRequestException);
  });
});

function createUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-08-04T00:00:00.000Z');

  return {
    id: 'user-id',
    firebaseUid: 'firebase-uid',
    email: 'user@example.com',
    name: 'Anne',
    locale: 'tr',
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createPregnancy(overrides: Partial<Pregnancy> = {}): Pregnancy {
  const now = new Date('2026-08-04T00:00:00.000Z');

  return {
    id: 'pregnancy-id',
    userId: 'user-id',
    datingMethod: DatingMethod.lmp,
    lastMenstrualPeriod: daysFromNow(-28),
    cycleLength: 28,
    doctorDueDate: null,
    status: PregnancyStatus.active,
    startedAt: now,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function daysFromNow(days: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
}
