import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CurrentUserGuard } from './current-user.guard';
import { CurrentUserService } from './current-user.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseAuthGuard,
    CurrentUserGuard,
    CurrentUserService,
  ],
  exports: [FirebaseAuthGuard, CurrentUserGuard, CurrentUserService],
})
export class AuthModule {}
