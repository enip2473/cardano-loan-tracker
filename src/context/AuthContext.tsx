// context/AuthContext.tsx
"use client"; // <-- Add this directive

import { createContext, useContext, useEffect, useState, ReactNode, JSX } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjust path if needed
import { Session, User, AuthError, SignUpWithPasswordCredentials, SignInWithPasswordCredentials } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation'; // <-- Use next/navigation for App Router

interface AuthContextType {
  signUp: (credentials: SignUpWithPasswordCredentials) => Promise<{ user: User | null; session: Session | null; error: AuthError | null; data: { user: User | null; session: Session | null; } }>;
  signIn: (credentials: SignInWithPasswordCredentials) => Promise<{ user: User | null; session: Session | null; error: AuthError | null; data: { user: User | null; session: Session | null; } }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter(); // For potential redirects within auth logic if needed

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting session:", error.message);
        setLoading(false);
        return;
      }
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Example: redirect on sign out or other auth events if needed
        // if (event === 'SIGNED_OUT') {
        //   router.push('/login');
        // }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]); // Added router to dependency array if used inside useEffect

  const value: AuthContextType = {
    signUp: async (credentials) => {
        const { data, error } = await supabase.auth.signUp(credentials);
        return { user: data.user, session: data.session, error, data };
    },
    signIn: async (credentials) => {
        const { data, error } = await supabase.auth.signInWithPassword(credentials);
        // If successful, onAuthStateChange will update user/session and trigger re-renders
        return { user: data.user, session: data.session, error, data };
    },
    signOut: async () => {
        const result = await supabase.auth.signOut();
        // onAuthStateChange will handle setting user/session to null
        return result;
    },
    user,
    session,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : <div>Loading authentication...</div>} {/* Or a proper loading spinner */}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};