import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';

type UnknownRecord = Record<string, unknown>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async syncUser(decodedToken: DecodedIdToken): Promise<User> {
    const { uid, email } = decodedToken;

    const rawName: unknown = decodedToken.name;
    const signInProvider = this.getSignInProvider(decodedToken.firebase);
    const emailVerified = decodedToken.email_verified === true;

    const name =
      typeof rawName === 'string' && rawName.trim().length > 0
        ? rawName.trim()
        : undefined;
    if (!uid) {
      throw new UnauthorizedException('Firebase token is missing a uid.');
    }

    if (!email) {
      throw new UnauthorizedException('Firebase token is missing an email.');
    }

    if (signInProvider === 'password' && !emailVerified) {
      throw new ForbiddenException('E-posta adresini doğrulaman gerekiyor.');
    }

    const userByFirebaseUid = await this.prisma.user.findUnique({
      where: {
        firebaseUid: uid,
      },
    });

    if (userByFirebaseUid) {
      return this.prisma.user.update({
        where: {
          id: userByFirebaseUid.id,
        },
        data: {
          email,
          ...(name ? { name } : {}),
        },
      });
    }

    const userByEmail = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (userByEmail) {
      if (userByEmail.firebaseUid && userByEmail.firebaseUid !== uid) {
        throw new ConflictException(
          'Bu e-posta adresi başka bir Firebase hesabına bağlı.',
        );
      }

      return this.prisma.user.update({
        where: {
          id: userByEmail.id,
        },
        data: {
          firebaseUid: uid,
          ...(name ? { name } : {}),
        },
      });
    }

    try {
      return await this.prisma.user.create({
        data: {
          firebaseUid: uid,
          email,
          ...(name ? { name } : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu Firebase hesabı veya e-posta adresi zaten kayıtlı.',
        );
      }

      throw error;
    }
  }

  private getSignInProvider(firebaseClaim: unknown): string | undefined {
    if (!this.isRecord(firebaseClaim)) {
      return undefined;
    }

    const signInProvider = firebaseClaim.sign_in_provider;

    return typeof signInProvider === 'string' ? signInProvider : undefined;
  }

  private isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
  }
}
