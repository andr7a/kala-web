import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Profile = {
  subscription_status?: string | null;
  subscription_tier?: string | null;
} | null;

type AuthContextType = {
  user: User | null;
  profile: Profile;
  isGuest: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signUp: (email: string, password: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<{ error: any | null }>;
  continueAsGuest: () => void;
};

const GUEST_MODE_KEY = 'guest_mode';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(user: User | null): Promise<Profile> {
  if (!user || !supabase) return null;
  try {
    // Default project convention: profiles table keyed by user.id
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUEST_MODE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // If Supabase isn't configured, fall back to guest mode.
      if (!supabase) {
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setIsGuest(true);
          try {
            localStorage.setItem(GUEST_MODE_KEY, '1');
          } catch {}
          setLoading(false);
        }
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user ?? null;
        if (isMounted) {
          setUser(sessionUser);
          const guest = !sessionUser && (localStorage.getItem(GUEST_MODE_KEY) === '1');
          setIsGuest(guest);
        }
        const p = await fetchProfile(sessionUser);
        if (isMounted) setProfile(p);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    if (!supabase) return () => {};

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      // If we have a real user, we are no longer a guest.
      const nextGuest = !nextUser && (localStorage.getItem(GUEST_MODE_KEY) === '1');
      setIsGuest(nextGuest);
      const p = await fetchProfile(nextUser);
      setProfile(p);
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const continueAsGuest = () => {
    setUser(null);
    setProfile(null);
    setIsGuest(true);
    try {
      localStorage.setItem(GUEST_MODE_KEY, '1');
    } catch {}
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: { message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' } };

    // Ensure we exit guest mode on successful auth.
    try {
      localStorage.setItem(GUEST_MODE_KEY, '0');
    } catch {}

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: { message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' } };
    try {
      localStorage.setItem(GUEST_MODE_KEY, '0');
    } catch {}

    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) {
      continueAsGuest();
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    // After sign out, treat as guest until they log in again.
    continueAsGuest();
    return { error };
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      isGuest: !user && isGuest,
      loading,
      signIn,
      signUp,
      signOut,
      continueAsGuest,
    }),
    [user, profile, isGuest, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
