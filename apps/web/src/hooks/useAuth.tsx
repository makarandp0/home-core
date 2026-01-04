// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  initializeFirebaseWithConfig,
  getFirebaseAuth,
  getGoogleProvider,
  type FirebaseConfig,
} from '../lib/firebase';
import { api } from '../lib/api';
import { HealthSchema } from '@ohs/types';

/**
 * User type for the auth context.
 */
export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Auth context value type.
 */
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  authEnabled: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  clearError: () => void;
}


const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Convert Firebase User to AuthUser.
 */
function toAuthUser(user: User): AuthUser {
  return {
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth provider component.
 * Fetches auth config from the backend on mount.
 * When auth is disabled, provides a mock user without Firebase.
 * When auth is enabled, manages Firebase auth state.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);

  // Firebase user reference for getIdToken
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // Ref to store unsubscribe function for proper cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch config from backend and initialize Firebase
  useEffect(() => {
    let cancelled = false;

    async function fetchConfigAndInitialize() {
      const result = await api.get('/api/health', HealthSchema);

      if (cancelled) return;

      if (!result.ok) {
        // Backend unavailable - leave authEnabled false, no user
        setError('Failed to fetch auth config');
        setLoading(false);
        return;
      }

      const isAuthEnabled = result.data.auth?.enabled === true;
      const firebaseConfig: FirebaseConfig | undefined = result.data.auth?.firebase;
      const defaultUser = result.data.auth?.defaultUser;

      if (!isAuthEnabled) {
        // Auth disabled - use default user from backend
        setAuthEnabled(false);
        if (defaultUser) {
          setUser(defaultUser);
        }
        setLoading(false);
        return;
      }

      if (!firebaseConfig) {
        // Auth enabled but config missing - treat as error, keep authEnabled false
        setError('Firebase config not available from backend');
        setLoading(false);
        return;
      }

      // Initialize Firebase with the fetched config
      initializeFirebaseWithConfig(firebaseConfig);

      const auth = getFirebaseAuth();
      if (!auth) {
        // Firebase init failed - treat as error, keep authEnabled false
        setError('Failed to initialize Firebase');
        setLoading(false);
        return;
      }

      // Only set authEnabled to true after successful Firebase initialization
      setAuthEnabled(true);

      // Subscribe to auth state changes
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        if (cancelled) return;
        if (fbUser) {
          setUser(toAuthUser(fbUser));
          setFirebaseUser(fbUser);
        } else {
          setUser(null);
          setFirebaseUser(null);
        }
        setLoading(false);
      });

      // Store unsubscribe in ref for cleanup
      unsubscribeRef.current = unsubscribe;
    }

    fetchConfigAndInitialize();

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!authEnabled) return;

    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Firebase not configured');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authEnabled]);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!authEnabled) return;

    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Firebase not configured');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authEnabled]);

  const signInWithGoogle = useCallback(async () => {
    if (!authEnabled) return;

    const auth = getFirebaseAuth();
    const provider = getGoogleProvider();
    if (!auth || !provider) {
      setError('Firebase not configured');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign in failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authEnabled]);

  const signOut = useCallback(async () => {
    if (!authEnabled) return;

    const auth = getFirebaseAuth();
    if (!auth) return;

    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
      throw err;
    }
  }, [authEnabled]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!authEnabled) return null;
    if (!firebaseUser) return null;

    try {
      return await firebaseUser.getIdToken();
    } catch (err) {
      console.error('Failed to get ID token:', err);
      return null;
    }
  }, [authEnabled, firebaseUser]);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    authEnabled,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    getIdToken,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
