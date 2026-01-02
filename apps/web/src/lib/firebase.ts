// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

/**
 * Check if authentication is enabled via environment variable.
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

/**
 * Initialize Firebase only when auth is enabled.
 * Returns null if auth is disabled or config is missing.
 */
function initializeFirebase(): { app: FirebaseApp; auth: Auth; googleProvider: GoogleAuthProvider } | null {
  if (!authEnabled) {
    return null;
  }

  if (app && auth && googleProvider) {
    return { app, auth, googleProvider };
  }

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  // Check if required config is present
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    console.error('Firebase config missing. Required env vars: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID');
    return null;
  }

  app = initializeApp(config);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();

  return { app, auth, googleProvider };
}

/**
 * Get Firebase Auth instance. Returns null if auth is disabled.
 */
export function getFirebaseAuth(): Auth | null {
  const firebase = initializeFirebase();
  return firebase?.auth ?? null;
}

/**
 * Get Google Auth Provider. Returns null if auth is disabled.
 */
export function getGoogleProvider(): GoogleAuthProvider | null {
  const firebase = initializeFirebase();
  return firebase?.googleProvider ?? null;
}
