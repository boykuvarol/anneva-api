import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { MeService } from './me.service';

@Controller('me')
@UseGuards(FirebaseAuthGuard, CurrentUserGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  getMe(@CurrentUser() user: User) {
    return this.meService.toResponse(user);
  }

  @Patch()
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    return this.meService.update(user, dto);
  }
}
