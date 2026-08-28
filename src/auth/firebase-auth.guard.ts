import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FIREBASE_SERVICE } from '../firebase/firebase.constants';
import type { FirebaseService } from '../firebase/firebase.service';
import type { FirebaseAuthenticatedRequest } from './types/firebase-authenticated-request';

type FirebaseTokenVerifier = Pick<FirebaseService, 'verifyIdToken'>;

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_SERVICE)
    private readonly firebaseService: FirebaseTokenVerifier,
  ) {}

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
