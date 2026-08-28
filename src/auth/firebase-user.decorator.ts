import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { FirebaseAuthenticatedRequest } from './types/firebase-authenticated-request';

export const FirebaseUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DecodedIdToken | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<FirebaseAuthenticatedRequest>();

    return request.user;
  },
);
