import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DatingMethod, PregnancyStatus, type User } from '@prisma/client';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreatePregnancyDto } from './dto/create-pregnancy.dto';
import { EndPregnancyDto } from './dto/end-pregnancy.dto';
import { UpdatePregnancyDto } from './dto/update-pregnancy.dto';
import { PregnanciesController } from './pregnancies.controller';
import { PregnanciesService } from './pregnancies.service';

type PregnanciesServiceMock = {
  create: jest.Mock<unknown, [User, CreatePregnancyDto]>;
  getCurrent: jest.Mock<unknown, [User]>;
  updateCurrent: jest.Mock<unknown, [User, UpdatePregnancyDto]>;
  endCurrent: jest.Mock<unknown, [User, EndPregnancyDto]>;
};

describe('PregnanciesController', () => {
  let controller: PregnanciesController;
  let service: PregnanciesServiceMock;
  let currentUser: User;
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    currentUser = createUser();
    service = {
      create: jest.fn<unknown, [User, CreatePregnancyDto]>(),
      getCurrent: jest.fn<unknown, [User]>(),
      updateCurrent: jest.fn<unknown, [User, UpdatePregnancyDto]>(),
      endCurrent: jest.fn<unknown, [User, EndPregnancyDto]>(),
    };
    controller = new PregnanciesController(
      service as unknown as PregnanciesService,
    );
    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  it('guards all pregnancy routes with FirebaseAuthGuard and CurrentUserGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      PregnanciesController,
    ) as unknown[];

    expect(guards).toEqual([FirebaseAuthGuard, CurrentUserGuard]);
  });

  it('POST create route uses the resolved current user', async () => {
    const dto = await transformBody(CreatePregnancyDto, {
      datingMethod: DatingMethod.lmp,
      lastMenstrualPeriod: daysFromNow(-28).toISOString(),
    });

    await controller.create(currentUser, dto);

    expect(service.create).toHaveBeenCalledWith(currentUser, dto);
  });

  it('GET current route uses the resolved current user', async () => {
    await controller.getCurrent(currentUser);

    expect(service.getCurrent).toHaveBeenCalledWith(currentUser);
  });

  it('PATCH current route uses the resolved current user', async () => {
    const dto = await transformBody(UpdatePregnancyDto, {
      cycleLength: 30,
    });

    await controller.updateCurrent(currentUser, dto);

    expect(service.updateCurrent).toHaveBeenCalledWith(currentUser, dto);
  });

  it('POST current/end route uses the resolved current user', async () => {
    const dto = await transformBody(EndPregnancyDto, {
      status: PregnancyStatus.completed,
    });

    await controller.endCurrent(currentUser, dto);

    expect(service.endCurrent).toHaveBeenCalledWith(currentUser, dto);
  });

  it('rejects body ownership injection for create', async () => {
    await expect(
      transformBody(CreatePregnancyDto, {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: daysFromNow(-28).toISOString(),
        userId: 'body-user-id',
        firebaseUid: 'body-firebase-uid',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects body ownership injection for update', async () => {
    await expect(
      transformBody(UpdatePregnancyDto, {
        cycleLength: 30,
        userId: 'body-user-id',
        firebaseUid: 'body-firebase-uid',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  function transformBody<T extends object>(
    metatype: new () => T,
    value: unknown,
  ): Promise<T> {
    return validationPipe.transform(value, {
      type: 'body',
      metatype,
    }) as Promise<T>;
  }
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

function daysFromNow(days: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
}
