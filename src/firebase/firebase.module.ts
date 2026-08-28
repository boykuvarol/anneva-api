import { Global, Module } from '@nestjs/common';
import { FIREBASE_SERVICE } from './firebase.constants';
import { FirebaseService } from './firebase.service';

@Global()
@Module({
  providers: [
    FirebaseService,
    {
      provide: FIREBASE_SERVICE,
      useExisting: FirebaseService,
    },
  ],
  exports: [FirebaseService, FIREBASE_SERVICE],
})
export class FirebaseModule {}
