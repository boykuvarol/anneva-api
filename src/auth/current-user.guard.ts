import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUserService } from './current-user.service';
import type { FirebaseAuthenticatedRequest } from './types/firebase-authenticated-request';

@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(private readonly currentUserService: CurrentUserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FirebaseAuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Geçerli kullanıcı oturumu bulunamadı.');
    }

    request.currentUser = await this.currentUserService.resolve(request.user);

    return true;
  }
}
