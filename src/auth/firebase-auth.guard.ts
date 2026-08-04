import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseService } from '../firebase/firebase.service';

type FirebaseAuthenticatedRequest = Request & {
  user?: DecodedIdToken;
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FirebaseAuthenticatedRequest>();
    const idToken = this.getBearerToken(request);

    try {
      request.user = await this.firebaseService.verifyIdToken(idToken);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid Firebase ID token.');
    }
  }

  private getBearerToken(request: Request): string {
    const authorization = request.headers.authorization;

    if (!authorization || typeof authorization !== 'string') {
      throw new UnauthorizedException('Missing Authorization bearer token.');
    }

    const [scheme, token, extra] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token || extra) {
      throw new UnauthorizedException('Malformed Authorization bearer token.');
    }

    return token;
  }
}
