import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataService } from '../lib/dataService';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = 'planora_local_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const p = await dataService.getProfile(userId);
      setProfile(p);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured()) {
        try {
          const { data } = await supabase.auth.getSession();
          if (mounted) {
            setSession(data.session);
            setUser(data.session?.user ?? null);
            if (data.session?.user) {
              await fetchProfile(data.session.user.id);
            }
          }
        } catch (err) {
          console.error('Supabase getSession error:', err);
        } finally {
          if (mounted) setLoading(false);
        }

        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (_event, currentSession) => {
            if (!mounted) return;
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            if (currentSession?.user) {
              await fetchProfile(currentSession.user.id);
            } else {
              setProfile(null);
            }
            setLoading(false);
          }
        );

        return () => {
          authListener.subscription.unsubscribe();
        };
      } else {
        // Fallback for immediate local operation
        const localSaved = localStorage.getItem(LOCAL_SESSION_KEY);
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            setUser(parsed);
            await fetchProfile(parsed.id);
          } catch {
            localStorage.removeItem(LOCAL_SESSION_KEY);
          }
        }
        setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      const mockUser: User = {
        id: 'user_' + btoa(email.toLowerCase()).replace(/=/g, '').slice(0, 12),
        app_metadata: {},
        user_metadata: { name: email.split('@')[0] },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email,
      } as any;
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockUser));
      setUser(mockUser);
      await fetchProfile(mockUser.id);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      setUser(data.user);
      setSession(data.session);
      await fetchProfile(data.user.id);
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!isSupabaseConfigured()) {
      const mockUser: User = {
        id: 'user_' + btoa(email.toLowerCase()).replace(/=/g, '').slice(0, 12),
        app_metadata: {},
        user_metadata: { name },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email,
      } as any;
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockUser));
      setUser(mockUser);
      const prof = await dataService.upsertProfile({
        id: mockUser.id,
        name,
        daily_hours: 2,
        session_min: 45,
        break_min: 10,
      });
      setProfile(prof);
      return { error: null, needsEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      return { error };
    }

    // Handle email confirmation requirement:
    // If Supabase has email confirmation enabled, data.session is null until verified
    if (!data.session) {
      return { error: null, needsEmailConfirmation: true };
    }

    if (data.user) {
      setUser(data.user);
      setSession(data.session);
      await fetchProfile(data.user.id);
    }

    return { error: null, needsEmailConfirmation: false };
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) {
      const mockUser: User = {
        id: 'google_user_' + Date.now().toString(36),
        app_metadata: { provider: 'google' },
        user_metadata: { name: 'Google Student', full_name: 'Google Student' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: 'student@gmail.com',
      } as any;
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockUser));
      setUser(mockUser);
      await fetchProfile(mockUser.id);
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured()) {
      return { error: null };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    return { error };
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const deleteAccount = async () => {
    if (user) {
      await dataService.clearUserData(user.id);
      await signOut();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        refreshProfile,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
