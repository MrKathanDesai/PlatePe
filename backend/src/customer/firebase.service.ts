import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) return; // already initialized

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase Admin not configured — customer phone auth will fail');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log('Firebase Admin initialized');
  }

  /** Verify a Firebase ID token and return the decoded claims */
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return admin.auth().verifyIdToken(idToken);
  }
}
