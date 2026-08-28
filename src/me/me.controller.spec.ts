import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { MeController } from './me.controller';
import { MeService } from './me.service';

type UserDelegateMock = {
  update: jest.MockedFunction<
    (args: {
      where: { id: string };
      data: { name?: string; locale?: string };
    }) => Promise<User>
  >;
};

describe('MeController', () => {
  let controller: MeController;
  let currentUser: User;
  let userDelegate: UserDelegateMock;
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    currentUser = createUser();
    userDelegate = {
      update: jest.fn<
        Promise<User>,
        [{ where: { id: string }; data: { name?: string; locale?: string } }]
      >(),
    };

    const service = new MeService({
      user: userDelegate,
    } as unknown as PrismaService);

    controller = new MeController(service);
    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  it('returns the current authenticated user', () => {
    expect(controller.getMe(currentUser)).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Anne',
      locale: 'tr',
      onboardingCompleted: false,
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
      updatedAt: new Date('2026-08-04T00:00:00.000Z'),
    });
  });

  it('updates only the current user name', async () => {
    const updatedUser = createUser({ name: 'Yeni İsim' });
    const dto = await transformUpdateMeDto({
      name: '  Yeni İsim  ',
    });

    userDelegate.update.mockResolvedValueOnce(updatedUser);

    await expect(controller.updateMe(currentUser, dto)).resolves.toEqual({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Yeni İsim',
      locale: 'tr',
      onboardingCompleted: false,
      createdAt: new Date('2026-08-04T00:00:00.000Z'),
      updatedAt: new Date('2026-08-04T00:00:00.000Z'),
    });

    expect(userDelegate.update).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
      },
      data: {
        name: 'Yeni İsim',
        locale: undefined,
      },
    });
  });

  it('updates the supported locale without allowing profile ownership changes', async () => {
    const updatedUser = createUser({ locale: 'tr' });
    const dto = await transformUpdateMeDto({
      locale: '  tr  ',
    });

    userDelegate.update.mockResolvedValueOnce(updatedUser);

    await expect(controller.updateMe(currentUser, dto)).resolves.toMatchObject({
      id: 'user-id',
      locale: 'tr',
      onboardingCompleted: false,
    });

    expect(userDelegate.update).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
      },
      data: {
        name: undefined,
        locale: 'tr',
      },
    });
  });

  it('rejects unsupported locales', async () => {
    await expect(
      transformUpdateMeDto({
        locale: 'en',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userDelegate.update).not.toHaveBeenCalled();
  });

  it('rejects unknown profile update fields', async () => {
    await expect(
      transformUpdateMeDto({
        name: 'Anne',
        email: 'other@example.com',
        firebaseUid: 'other-firebase-uid',
        onboardingCompleted: true,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userDelegate.update).not.toHaveBeenCalled();
  });

  async function transformUpdateMeDto(value: unknown): Promise<UpdateMeDto> {
    return validationPipe.transform(value, {
      type: 'body',
      metatype: UpdateMeDto,
    }) as Promise<UpdateMeDto>;
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
