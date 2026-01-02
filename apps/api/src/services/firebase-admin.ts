// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;
let cachedProjectId: string | null = null;

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

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
  console.log('[Firebase] initializeFirebase called');
  console.log(`[Firebase] AUTH_ENABLED="${process.env.AUTH_ENABLED}"`);

  if (!isAuthEnabled()) {
    console.log('[Firebase] Authentication disabled (AUTH_ENABLED != true)');
    return;
  }

  if (firebaseApp || getApps().length > 0) {
    console.log('[Firebase] Already initialized, skipping');
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasServiceAccountJson = !!serviceAccountJson;
  const serviceAccountLength = serviceAccountJson?.length ?? 0;
  console.log(`[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON present: ${hasServiceAccountJson}, length: ${serviceAccountLength}`);

  if (!serviceAccountJson) {
    console.error('[Firebase] ERROR: FIREBASE_SERVICE_ACCOUNT_JSON is missing');
    console.error('[Firebase] Available env vars:', Object.keys(process.env).filter(k => k.includes('FIREBASE') || k.includes('AUTH')).join(', '));
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required when AUTH_ENABLED=true'
    );
  }

  try {
    console.log('[Firebase] Normalizing service account JSON...');
    // Handle newline issues in service account JSON from environment variables:
    // - Actual newlines in the JSON (control characters) need to be escaped as \n
    // - This commonly happens when the env var contains literal newlines
    const normalizedJson = serviceAccountJson
      .replace(/\r\n/g, '\\n')  // Windows line endings
      .replace(/\n/g, '\\n');    // Unix line endings

    console.log('[Firebase] Parsing service account JSON...');
    // Parse once and extract both service account and project_id
    const parsed: Record<string, unknown> = JSON.parse(normalizedJson);
    console.log(`[Firebase] Parsed successfully, project_id: ${parsed.project_id ?? 'NOT FOUND'}`);

    if (typeof parsed.project_id === 'string') {
      cachedProjectId = parsed.project_id;
    }
    // cert() accepts the parsed object directly
    console.log('[Firebase] Initializing Firebase app with credentials...');
    firebaseApp = initializeApp({ credential: cert(parsed) });
    firebaseAuth = getAuth(firebaseApp);
    console.log('[Firebase] Firebase Admin SDK initialized successfully');
  } catch (err) {
    console.error('[Firebase] ERROR during initialization:', err);
    // Log first 100 chars of JSON to help debug format issues (no sensitive data in that prefix)
    console.error('[Firebase] JSON starts with:', serviceAccountJson.substring(0, 100));
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

/**
 * Get Firebase client configuration for the frontend.
 * Returns null if auth is disabled or required config is missing.
 */
export function getFirebaseClientConfig(): FirebaseClientConfig | null {
  console.log('[Firebase] getFirebaseClientConfig called');

  if (!isAuthEnabled()) {
    console.log('[Firebase] Auth disabled, returning null config');
    return null;
  }

  // Ensure Firebase is initialized to get the project ID
  if (!cachedProjectId) {
    console.log('[Firebase] No cached project_id, attempting to extract from service account');
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        cachedProjectId = serviceAccount.project_id ?? null;
        console.log(`[Firebase] Extracted project_id: ${cachedProjectId ?? 'null'}`);
      } catch (e) {
        console.warn('[Firebase] Failed to parse service account for project_id:', e);
        // Ignore parse errors, will be caught during proper initialization
      }
    } else {
      console.warn('[Firebase] No FIREBASE_SERVICE_ACCOUNT_JSON available for project_id extraction');
    }
  }

  const apiKey = process.env.FIREBASE_CLIENT_API_KEY;
  const appId = process.env.FIREBASE_CLIENT_APP_ID;

  console.log(`[Firebase] Client config check - apiKey: ${apiKey ? 'present' : 'MISSING'}, appId: ${appId ? 'present' : 'MISSING'}, projectId: ${cachedProjectId ?? 'MISSING'}`);

  if (!apiKey || !appId || !cachedProjectId) {
    console.warn(
      '[Firebase] Client config incomplete. Required: FIREBASE_CLIENT_API_KEY, FIREBASE_CLIENT_APP_ID, and project_id in service account'
    );
    return null;
  }

  console.log('[Firebase] Returning complete client config');
  return {
    apiKey,
    authDomain: `${cachedProjectId}.firebaseapp.com`,
    projectId: cachedProjectId,
    appId,
  };
}
