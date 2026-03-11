import React, { createContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import {
  getOrCreateProfile,
  checkAndResetMonthly,
  validatePhoneBinding,
  linkPhoneToProfile,
} from '../logic/userService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;
    console.log('[AuthContext] Mounting AuthProvider. loading=true');

    // Safety timeout: if Supabase hangs, force loading to false after 3 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[AuthContext] Supabase init timed out! Forcing loading=false');
        setLoading(false);
      }
    }, 3000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] getSession result:', session);
      if (!mounted) return;
      setSession(session);
      if (session) {
        console.log('[AuthContext] Session found, loading profile...');
        loadProfile(session.user).finally(() => {
          console.log('[AuthContext] Finished loading profile.');
          if (mounted) setLoading(false);
        });
      } else {
        console.log('[AuthContext] No session found. Setting loading=false');
        setLoading(false);
      }
    }).catch((err) => {
      console.error('[AuthContext] getSession error:', err);
      if (mounted) setLoading(false);
    });

    // Listen for auth changes (after OAuth redirect, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[AuthContext] onAuthStateChange event:', _event, session);
        if (!mounted) return;
        
        if (session) {
          setSession(session);
          // Load profile in background, don't block the UI
          loadProfile(session.user).catch(console.error);
          setLoading(false);
        } else {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(user) {
    try {
      const { profile: raw, error } = await getOrCreateProfile(user);
      if (error) {
        console.error('loadProfile getOrCreate error:', error);
        return;
      }
      if (!raw) return;

      const { profile: updated } = await checkAndResetMonthly(raw);
      setProfile(updated || raw);
    } catch (err) {
      console.error('loadProfile exception:', err);
    }
  }

  // Google OAuth — redirects to Google, then returns to origin
  async function signInWithGoogle() {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    console.log('[AuthContext] signInWithGoogle redirecting to:', window.location.origin);
    if (error) setAuthError(error.message);
  }

  // Send Email OTP
  async function sendEmailVerificationOTP() {
    setAuthError(null);
    if (!session?.user?.email) {
      setAuthError('Email não encontrado. Faça login com o Google primeiro.');
      return false;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: session.user.email,
        options: { shouldCreateUser: false }
      });

      if (error) {
        setAuthError(error.message);
        return false;
      }
      return true;
    } catch (err) {
      setAuthError('Erro ao enviar email. Tente novamente.');
      return false;
    }
  }

  // Verify Email OTP
  async function verifyEmailOTP(token) {
    setAuthError(null);
    if (!session?.user?.email) return false;

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: session.user.email,
        token,
        type: 'email',
      });

      if (error) {
        setAuthError('Código incorreto ou expirado. Tente novamente.');
        return false;
      }

      const currentUser = session?.user || data?.user;
      if (!currentUser) {
        setAuthError('Sessão inválida. Faça login novamente.');
        return false;
      }

      // Mark user as verified by saving 'verified_email' in the phone column
      const { profile: saved } = await linkPhoneToProfile(currentUser.id, 'verified_email');
      setProfile(saved);
      return true;
    } catch (err) {
      setAuthError('Erro ao verificar o código. Tente novamente.');
      return false;
    }
  }

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setLoading(false);
  }

  // Bypass for testing/dev: Mark user as verified immediately
  async function skipVerification() {
    setLoading(true);
    try {
      // If no session exists (e.g. bypass from Welcome screen), we'll do a mock login
      // but in this app we need a UID. For now, we'll try to get the session first.
      const { data: { session: current } } = await supabase.auth.getSession();
      const targetUid = current?.user?.id || session?.user?.id;

      if (!targetUid) {
        setAuthError('Não foi possível pular sem uma sessão Google. Tente carregar a página.');
        return false;
      }

      const { profile: saved } = await linkPhoneToProfile(targetUid, 'verified_email');
      setProfile(saved);
      return true;
    } catch (err) {
      console.error('Bypass error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }

  const value = {
    session,
    profile,
    setProfile,
    loading,
    authError,
    setAuthError,
    signInWithGoogle,
    sendEmailVerificationOTP,
    verifyEmailOTP,
    signOut,
    skipVerification,
    isAuthenticated: !!session, // Open immediately if session exists
    needsVerification: false, // OTP disabled to unblock user as requested
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
