import * as React from 'react';
import { useState, useEffect, createContext, useContext } from 'react';
import { rawSupabase } from '../lib/firebaseClient';
import { db } from '../lib/dexieDb';
import { indexedDbService } from '../services/indexedDbService';
import { usePOSStore } from '../store/posStore';

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
    console.log('[Auth] Initializing AuthProvider with IndexedDB support...');
    let isMounted = true;

    // 1. Try to restore session from IndexedDB first for instant loading and offline support
    db.settings.get('current_user_session').then((sessionRecord) => {
      if (!isMounted) return;
      if (sessionRecord && sessionRecord.value) {
        setUser(sessionRecord.value);
        setLoading(false);
        console.log('[Auth] Restored user session from IndexedDB:', sessionRecord.value.email);
      }
    }).catch((err) => {
      console.warn('[Auth] Failed to restore session from IndexedDB:', err);
    });

    // 2. Use onAuthStateChange which wraps Firebase's onAuthStateChanged
    const { data: { subscription } } = rawSupabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      console.log(`[Auth] onAuthStateChange event received: ${event}`, session?.user ? `User: ${session.user.email}` : 'No session user');
      
      if (session?.user) {
        const newUser: AuthUser = {
          $id: session.user.id,
          email: session.user.email || '',
        };
        setUser(newUser);
        await db.settings.put({
          id: 'current_user_session',
          key: 'current_user_session',
          value: newUser,
          syncStatus: 'synced',
        });
        console.log('[Auth] User state set and saved to IndexedDB:', session.user.email);
        setLoading(false);
      } else {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        // Only clear the user state if we are explicitly signing out or if we are online (meaning the session expired on the server)
        if (event === 'SIGNED_OUT' || !isOffline) {
          setUser(null);
          await db.settings.delete('current_user_session');
          console.log('[Auth] User state cleared and removed from IndexedDB');
        } else {
          console.log('[Auth] Offline and no Firebase session, retaining IndexedDB session');
        }
        setLoading(false);
      }
    });

    // 3. We can also check initial session if already loaded synchronously in firebase cache
    rawSupabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      console.log('[Auth] Initial getSession response:', session?.user ? `User logged in: ${session.user.email}` : 'No active user in initial getSession');
      if (session?.user) {
        const newUser: AuthUser = {
          $id: session.user.id,
          email: session.user.email || '',
        };
        setUser(newUser);
        await db.settings.put({
          id: 'current_user_session',
          key: 'current_user_session',
          value: newUser,
          syncStatus: 'synced',
        });
        setLoading(false);
        console.log('[Auth] Synchronous session recovered from cache, saved to IndexedDB, loading set to false');
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
    try {
      await db.settings.delete('current_user_session');
      await indexedDbService.clearAllPOSCache();
      usePOSStore.getState().resetStore();
      
      // Clear localStorage active business/branch to prevent stale session pollution
      localStorage.removeItem('tareza_active_business_id');
      localStorage.removeItem('tareza_active_branch_id');
    } catch (err) {
      console.error('Error clearing local cache on signout:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
