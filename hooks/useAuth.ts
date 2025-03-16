import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const [isRouterReady, setIsRouterReady] = useState(false);

  // Check if router is ready
  useEffect(() => {
    if (segments.length > 0) {
      setIsRouterReady(true);
    }
  }, [segments]);

  // Handle auth state changes - only after router is ready
  useEffect(() => {
    // Don't set up auth handling until router is ready
    if (!isRouterReady) return;

    // Get initial session
    const getInitialSession = async () => {
      try {
        setIsLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        setIsLoggedIn(!!sessionData.session);
        setAuthInitialized(true);
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Set up auth state change subscriber
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        
        // Only handle navigation events if router is ready
        if (!isRouterReady) return;
        
        // Skip navigation for auth callback pages to prevent loops
        const currentPath = segments.join('/');
        const isAuthCallbackPage = currentPath.includes('auth/callback');
        
        if (isAuthCallbackPage) {
          console.log('In auth callback page, skipping navigation');
          return;
        }

        setIsLoggedIn(!!session);

        // Handle special auth events
        if (event === 'PASSWORD_RECOVERY') {
          // For PASSWORD_RECOVERY, we'll let the auth callback handle it
          // Don't redirect here to avoid conflicts
          return;
        }

        // Default protection - redirect based on auth state
        const isAuthGroup = segments[0] === '(auth)';
        
        if (session && isAuthGroup) {
          // Logged in, on auth page, redirect to app
          router.push('/(tabs)');
        } else if (!session && !isAuthGroup) {
          // Not logged in, not on auth page, redirect to login
          router.push('/login');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isRouterReady, router, segments]);

  return { isLoggedIn, isLoading, authInitialized };
} 