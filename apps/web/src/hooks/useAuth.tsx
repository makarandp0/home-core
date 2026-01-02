// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { authEnabled, getFirebaseAuth, getGoogleProvider } from '../lib/firebase';

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

/**
 * Default anonymous user for when auth is disabled.
 */
const DEFAULT_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'anonymous@local',
  displayName: 'Local User',
  photoURL: null,
};

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
 * When auth is disabled, provides a mock user without Firebase.
 * When auth is enabled, manages Firebase auth state.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(authEnabled ? null : DEFAULT_USER);
  const [loading, setLoading] = useState(authEnabled);
  const [error, setError] = useState<string | null>(null);

  // Firebase user reference for getIdToken
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    if (!authEnabled) {
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Firebase not configured');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setUser(toAuthUser(fbUser));
        setFirebaseUser(fbUser);
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
  }, []);

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
  }, []);

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
  }, []);

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
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!authEnabled) return null;
    if (!firebaseUser) return null;

    try {
      return await firebaseUser.getIdToken();
    } catch (err) {
      console.error('Failed to get ID token:', err);
      return null;
    }
  }, [firebaseUser]);

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
