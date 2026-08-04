import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

type FirebaseAuthenticatedRequest = Request & {
  user: DecodedIdToken;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  sync(@Req() request: FirebaseAuthenticatedRequest) {
    return this.authService.syncUser(request.user);
  }
}
