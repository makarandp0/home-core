// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { initializeApp, getApps, cert, type ServiceAccount, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

/**
 * Check if authentication is enabled via environment variable
 */
export function isAuthEnabled(): boolean {
  return process.env.AUTH_ENABLED === 'true';
}

/**
 * Initialize Firebase Admin SDK
 * Only called when AUTH_ENABLED=true
 */
export function initializeFirebase(): void {
  if (!isAuthEnabled()) {
    console.log('Authentication disabled (AUTH_ENABLED != true)');
    return;
  }

  if (firebaseApp || getApps().length > 0) {
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required when AUTH_ENABLED=true'
    );
  }

  try {
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
    firebaseApp = initializeApp({ credential: cert(serviceAccount) });
    firebaseAuth = getAuth(firebaseApp);
    console.log('Firebase Admin SDK initialized');
  } catch (err) {
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err}`);
  }
}

/**
 * Get Firebase Auth instance
 * Throws if called when auth is disabled or not initialized
 */
export function getFirebaseAuth(): Auth {
  if (!isAuthEnabled()) {
    throw new Error('Firebase Auth is not available when AUTH_ENABLED != true');
  }

  if (!firebaseAuth) {
    initializeFirebase();
  }

  if (!firebaseAuth) {
    throw new Error('Firebase Auth not initialized');
  }

  return firebaseAuth;
}
