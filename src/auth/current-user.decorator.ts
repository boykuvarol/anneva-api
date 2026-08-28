import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { FirebaseAuthenticatedRequest } from './types/firebase-authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<FirebaseAuthenticatedRequest>();

    return request.currentUser;
  },
);
