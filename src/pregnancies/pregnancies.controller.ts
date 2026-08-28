import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreatePregnancyDto } from './dto/create-pregnancy.dto';
import { EndPregnancyDto } from './dto/end-pregnancy.dto';
import { UpdatePregnancyDto } from './dto/update-pregnancy.dto';
import { PregnanciesService } from './pregnancies.service';

@Controller('pregnancies')
@UseGuards(FirebaseAuthGuard, CurrentUserGuard)
export class PregnanciesController {
  constructor(private readonly pregnanciesService: PregnanciesService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreatePregnancyDto) {
    return this.pregnanciesService.create(user, dto);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: User) {
    return this.pregnanciesService.getCurrent(user);
  }

  @Patch('current')
  updateCurrent(@CurrentUser() user: User, @Body() dto: UpdatePregnancyDto) {
    return this.pregnanciesService.updateCurrent(user, dto);
  }

  @Post('current/end')
  endCurrent(@CurrentUser() user: User, @Body() dto: EndPregnancyDto) {
    return this.pregnanciesService.endCurrent(user, dto);
  }
}
