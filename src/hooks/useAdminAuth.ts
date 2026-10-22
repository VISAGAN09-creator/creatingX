import {
  browserLocalPersistence,
  browserSessionPersistence,
  onIdTokenChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';

export type AdminAuthStatus = 'loading' | 'signedOut' | 'unauthorized' | 'authorized';

function loginErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password.';
  }
  if (code === 'auth/too-many-requests') return 'Too many unsuccessful attempts. Please try again later.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return 'Unable to sign in. Please try again.';
}

export function useAdminAuth() {
  const [status, setStatus] = useState<AdminAuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onIdTokenChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setStatus('signedOut');
        return;
      }

      try {
        const token = await nextUser.getIdTokenResult();
        setUser(nextUser);
        setStatus(token.claims.admin === true ? 'authorized' : 'unauthorized');
      } catch {
        setUser(null);
        setStatus('signedOut');
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      throw new Error(loginErrorMessage(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return { status, user, signIn, signOut };
}
