import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrentUserService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(decodedToken: DecodedIdToken): Promise<User> {
    const firebaseUid = decodedToken.uid;

    if (!firebaseUid) {
      throw new UnauthorizedException('Geçerli kullanıcı oturumu bulunamadı.');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        firebaseUid,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Anneva kullanıcı kaydı bulunamadı.');
    }

    return user;
  }
}
