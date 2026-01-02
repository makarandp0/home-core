// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let isInitialized = false;

/**
 * Initialize Firebase with config fetched from the backend.
 * Must be called before using getFirebaseAuth() or getGoogleProvider().
 */
export function initializeFirebaseWithConfig(config: FirebaseConfig): void {
  if (isInitialized) {
    return;
  }

  app = initializeApp(config);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  isInitialized = true;
}

/**
 * Check if Firebase has been initialized.
 */
export function isFirebaseInitialized(): boolean {
  return isInitialized;
}

/**
 * Get Firebase Auth instance.
 * Returns null if Firebase is not initialized.
 */
export function getFirebaseAuth(): Auth | null {
  return auth;
}

/**
 * Get Google Auth Provider.
 * Returns null if Firebase is not initialized.
 */
export function getGoogleProvider(): GoogleAuthProvider | null {
  return googleProvider;
}
