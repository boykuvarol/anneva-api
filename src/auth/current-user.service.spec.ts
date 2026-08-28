import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserService } from './current-user.service';

type UserDelegateMock = {
  findUnique: jest.MockedFunction<
    (args: { where: { firebaseUid: string } }) => Promise<User | null>
  >;
};

describe('CurrentUserService', () => {
  let service: CurrentUserService;
  let userDelegate: UserDelegateMock;

  beforeEach(() => {
    userDelegate = {
      findUnique: jest.fn<
        Promise<User | null>,
        [{ where: { firebaseUid: string } }]
      >(),
    };

    service = new CurrentUserService({
      user: userDelegate,
    } as unknown as PrismaService);
  });

  it('resolves the PostgreSQL user for a verified Firebase token', async () => {
    const user = createUser({ firebaseUid: 'firebase-uid' });

    userDelegate.findUnique.mockResolvedValueOnce(user);

    await expect(service.resolve(createDecodedToken())).resolves.toEqual(user);
    expect(userDelegate.findUnique).toHaveBeenCalledWith({
      where: {
        firebaseUid: 'firebase-uid',
      },
    });
  });

  it('throws 401 when a valid Firebase token has no matching PostgreSQL user', async () => {
    userDelegate.findUnique.mockResolvedValueOnce(null);

    await expect(service.resolve(createDecodedToken())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

function createDecodedToken(
  overrides: Partial<DecodedIdToken> = {},
): DecodedIdToken {
  return {
    aud: 'anneva',
    auth_time: 1,
    email: 'user@example.com',
    exp: 2,
    firebase: {
      identities: {},
      sign_in_provider: 'password',
    },
    iat: 1,
    iss: 'https://securetoken.google.com/anneva',
    sub: 'firebase-uid',
    uid: 'firebase-uid',
    ...overrides,
  };
}

function createUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-08-04T00:00:00.000Z');

  return {
    id: 'user-id',
    firebaseUid: null,
    email: 'user@example.com',
    name: 'Anne',
    locale: 'tr',
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
