import * as React from 'react';
import { useState, useEffect, createContext, useContext } from 'react';
import { rawSupabase } from '../lib/supabaseClient';

type AuthUser = {
  $id: string;
  email: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Auth] Initializing AuthProvider...');
    let isMounted = true;

    // Use onAuthStateChange which wraps Firebase's onAuthStateChanged
    const { data: { subscription } } = rawSupabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      console.log(`[Auth] onAuthStateChange event received: ${event}`, session?.user ? `User: ${session.user.email}` : 'No session user');
      
      if (session?.user) {
        setUser({
          $id: session.user.id,
          email: session.user.email || '',
        });
        console.log('[Auth] User state set:', session.user.email);
      } else {
        setUser(null);
        console.log('[Auth] User state cleared (set to null)');
      }
      
      setLoading(false);
      console.log('[Auth] Loading state set to false');
    });

    // We can also check initial session if already loaded synchronously in firebase cache
    rawSupabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      console.log('[Auth] Initial getSession response:', session?.user ? `User logged in: ${session.user.email}` : 'No active user in initial getSession');
      if (session?.user) {
        setUser({
          $id: session.user.id,
          email: session.user.email || '',
        });
        setLoading(false);
        console.log('[Auth] Synchronous session recovered from cache, loading set to false');
      }
    }).catch((err) => {
      console.error('[Auth] Error getting initial session:', err);
    });

    return () => {
      console.log('[Auth] Cleaning up AuthProvider subscription.');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await rawSupabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error', e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
