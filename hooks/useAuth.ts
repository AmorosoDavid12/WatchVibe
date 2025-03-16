import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

export function useAuth() {
  const segments = useSegments();
  const router = useRouter();
  const [authInitialized, setAuthInitialized] = useState(false);

  // Check if the user is authenticated
  useEffect(() => {
    // Set up a subscription to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        const isLoggedIn = !!session?.user;
        const isAuthGroup = segments[0] === '(auth)';

        if (!authInitialized) {
          setAuthInitialized(true);
        }

        // Auth logic
        if (!isLoggedIn && !isAuthGroup) {
          // If user is not logged in and not on the auth screen, redirect to login
          router.replace('/login');
        } else if (isLoggedIn && isAuthGroup) {
          // If user is logged in and on an auth screen, redirect to main app
          router.replace('/(tabs)');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [segments, authInitialized]);

  return { authInitialized };
} 