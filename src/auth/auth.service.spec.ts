import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type FindUniqueArgs = {
  where: {
    firebaseUid?: string;
    email?: string;
  };
};

type UpdateArgs = {
  where: {
    id: string;
  };
  data: Prisma.UserUpdateInput;
};

type CreateArgs = {
  data: Prisma.UserCreateInput;
};

type UserDelegateMock = {
  findUnique: jest.Mock<Promise<User | null>, [FindUniqueArgs]>;
  update: jest.Mock<Promise<User>, [UpdateArgs]>;
  create: jest.Mock<Promise<User>, [CreateArgs]>;
};

describe('AuthService', () => {
  let service: AuthService;
  let userDelegate: UserDelegateMock;

  beforeEach(() => {
    userDelegate = {
      findUnique: jest.fn<Promise<User | null>, [FindUniqueArgs]>(),
      update: jest.fn<Promise<User>, [UpdateArgs]>(),
      create: jest.fn<Promise<User>, [CreateArgs]>(),
    };

    service = new AuthService({
      user: userDelegate,
    } as unknown as PrismaService);
  });

  it('throws 403 when a password provider email is not verified', async () => {
    await expect(
      service.syncUser(
        createDecodedToken({
          email_verified: false,
          firebase: createFirebaseClaim('password'),
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(userDelegate.findUnique).not.toHaveBeenCalled();
    expect(userDelegate.update).not.toHaveBeenCalled();
    expect(userDelegate.create).not.toHaveBeenCalled();
  });

  it('syncs a verified password provider user', async () => {
    const existingUser = createUser({
      firebaseUid: 'firebase-uid',
      email: 'old@example.com',
    });
    const syncedUser = createUser({
      firebaseUid: 'firebase-uid',
      email: 'user@example.com',
      name: 'Anne',
    });

    userDelegate.findUnique.mockResolvedValueOnce(existingUser);
    userDelegate.update.mockResolvedValueOnce(syncedUser);

    await expect(
      service.syncUser(
        createDecodedToken({
          email_verified: true,
          firebase: createFirebaseClaim('password'),
          name: 'Anne',
        }),
      ),
    ).resolves.toEqual(syncedUser);

    expect(userDelegate.update).toHaveBeenCalledWith({
      where: {
        id: existingUser.id,
      },
      data: {
        email: 'user@example.com',
        name: 'Anne',
      },
    });
  });

  it('syncs a Google provider user without a separate verification step', async () => {
    const createdUser = createUser({
      firebaseUid: 'firebase-uid',
      email: 'user@example.com',
    });

    userDelegate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    userDelegate.create.mockResolvedValueOnce(createdUser);

    await expect(
      service.syncUser(
        createDecodedToken({
          email_verified: false,
          firebase: createFirebaseClaim('google.com'),
        }),
      ),
    ).resolves.toEqual(createdUser);

    expect(userDelegate.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: 'firebase-uid',
        email: 'user@example.com',
      },
    });
  });

  it('syncs an Apple provider user without a separate verification step', async () => {
    const createdUser = createUser({
      firebaseUid: 'firebase-uid',
      email: 'user@example.com',
    });

    userDelegate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    userDelegate.create.mockResolvedValueOnce(createdUser);

    await expect(
      service.syncUser(
        createDecodedToken({
          email_verified: false,
          firebase: createFirebaseClaim('apple.com'),
        }),
      ),
    ).resolves.toEqual(createdUser);

    expect(userDelegate.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: 'firebase-uid',
        email: 'user@example.com',
      },
    });
  });

  it('throws 401 when the verified Firebase token has no email', async () => {
    await expect(
      service.syncUser(
        createDecodedToken({
          email: undefined,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(userDelegate.findUnique).not.toHaveBeenCalled();
  });

  it('attaches firebaseUid to a legacy user with a matching email', async () => {
    const legacyUser = createUser({
      id: 'legacy-user-id',
      firebaseUid: null,
      email: 'user@example.com',
    });
    const syncedUser = createUser({
      id: 'legacy-user-id',
      firebaseUid: 'firebase-uid',
      email: 'user@example.com',
    });

    userDelegate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(legacyUser);
    userDelegate.update.mockResolvedValueOnce(syncedUser);

    await expect(service.syncUser(createDecodedToken())).resolves.toEqual(
      syncedUser,
    );

    expect(userDelegate.update).toHaveBeenCalledWith({
      where: {
        id: 'legacy-user-id',
      },
      data: {
        firebaseUid: 'firebase-uid',
      },
    });
  });

  it('throws 409 when an email is already linked to a different Firebase UID', async () => {
    const linkedUser = createUser({
      firebaseUid: 'different-firebase-uid',
      email: 'user@example.com',
    });

    userDelegate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(linkedUser);

    await expect(service.syncUser(createDecodedToken())).rejects.toThrow(
      ConflictException,
    );

    expect(userDelegate.update).not.toHaveBeenCalled();
    expect(userDelegate.create).not.toHaveBeenCalled();
  });
});

function createDecodedToken(
  overrides: Partial<DecodedIdToken> = {},
): DecodedIdToken {
  const baseToken: DecodedIdToken = {
    aud: 'anneva',
    auth_time: 1,
    email: 'user@example.com',
    email_verified: true,
    exp: 2,
    firebase: createFirebaseClaim('password'),
    iat: 1,
    iss: 'https://securetoken.google.com/anneva',
    sub: 'firebase-uid',
    uid: 'firebase-uid',
  };

  return {
    ...baseToken,
    ...overrides,
    firebase: {
      ...baseToken.firebase,
      ...overrides.firebase,
    },
  };
}

function createFirebaseClaim(
  signInProvider: string,
): DecodedIdToken['firebase'] {
  return {
    identities: {},
    sign_in_provider: signInProvider,
  };
}

function createUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-08-04T00:00:00.000Z');

  return {
    id: 'user-id',
    firebaseUid: null,
    email: 'user@example.com',
    name: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
