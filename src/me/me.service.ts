import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

type MeResponse = {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  toResponse(user: User): MeResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(user: User, dto: UpdateMeDto): Promise<MeResponse> {
    const updatedUser = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        name: dto.name,
        locale: dto.locale,
      },
    });

    return this.toResponse(updatedUser);
  }
}
