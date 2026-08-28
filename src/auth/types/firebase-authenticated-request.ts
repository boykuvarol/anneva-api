import type { User } from '@prisma/client';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';

export type FirebaseAuthenticatedRequest = Request & {
  user?: DecodedIdToken;
  currentUser?: User;
};
