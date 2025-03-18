import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { useWatchedStore } from '@/lib/watchedStore';

/**
 * Authentication Hook
 * 
 * This hook provides authentication state management and protected routing.
 * IMPORTANT: This file contains critical logic for handling password reset flows.
 * 
 * WARNING: Modifying this file's logic can break authentication and password reset functionality.
 * The URL parameters handling, recovery session detection, and navigation logic are particularly
 * sensitive to changes.
 */

export default function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const [isRouterReady, setIsRouterReady] = useState(false);
  
  // Get the sync functions from stores
  const syncWatchlist = useWatchlistStore(state => state.syncWithSupabase);
  const syncWatched = useWatchedStore(state => state.syncWithSupabase);

  // Function to sync all data
  const syncAllData = async () => {
    try {
      console.log('Starting data synchronization');
      // Create a promise that rejects after a timeout to avoid getting stuck
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Data sync timeout')), 5000);
      });
      
      // Race the actual sync with the timeout
      await Promise.race([
        Promise.all([
          syncWatchlist(),
          syncWatched()
        ]),
        timeoutPromise
      ]);
      console.log('Data synchronization completed');
      return true;
    } catch (error) {
      console.error('Error syncing data:', error);
      // Return true to avoid blocking the UI
      return true;
    }
  };

  // Check if router is ready - important to prevent navigation before router is mounted
  useEffect(() => {
    if (segments.length > 0) {
      setIsRouterReady(true);
    }
  }, [segments]);

  /**
   * CRITICAL: Password reset detection
   * This effect runs on initial load to detect if the user arrived via a password reset link
   * It checks URL parameters and hash fragments for recovery tokens
   * DO NOT MODIFY unless you thoroughly understand Supabase auth flows
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if we're coming from a password reset link
    const checkForPasswordRecovery = () => {
      console.log('Checking for password reset flow');
      // Check URL hash for recovery token
      const hash = window.location.hash.substring(1);
      const urlParams = new URLSearchParams(window.location.search);
      
      // Recovery tokens can be in the hash fragment or search params
      const isRecoveryInHash = hash && (hash.includes('type=recovery') || hash.includes('access_token'));
      const isRecoveryInSearch = urlParams.get('type') === 'recovery';
      
      console.log('Login params - source:', urlParams.get('source'), 'email:', urlParams.get('email'));
      
      if (isRecoveryInHash || isRecoveryInSearch) {
        console.log('Recovery parameters detected in URL');
        // Set markers in localStorage to maintain recovery state across page loads
        localStorage.setItem('isRecoverySession', 'true');
        localStorage.setItem('passwordResetTimestamp', Date.now().toString());
      }
    };
    
    checkForPasswordRecovery();
  }, []);

  /**
   * Recovery session redirect handler
   * This effect ensures users in a recovery session stay on the reset password page
   * This runs AFTER the router is ready to prevent "navigation before mount" errors
   */
  useEffect(() => {
    // Only proceed if router is ready
    if (!isRouterReady) return;
    
    const checkRecoverySession = async () => {
      try {
        // Check for recovery session marker in localStorage
        if (typeof window !== 'undefined' && localStorage.getItem('isRecoverySession') === 'true') {
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('Recovery session detected, redirecting to reset-password');
            
            // Force navigation to reset password if not already there
            const currentPath = segments.join('/');
            if (!currentPath.includes('reset-password')) {
              // router.replace prevents adding to history stack, avoiding back-button issues
              router.replace('/reset-password');
            }
          }
        }
      } catch (error) {
        console.error('Error checking recovery session:', error);
      }
    };
    
    checkRecoverySession();
  }, [isRouterReady, router, segments]);

  /**
   * Main authentication effect
   * Handles session initialization and auth state changes
   * Contains special logic for password recovery sessions
   */
  useEffect(() => {
    let isComponentMounted = true;
    
    // Safety timeout to prevent getting stuck in the loading state
    const safetyTimeout = setTimeout(() => {
      if (isComponentMounted && isLoading) {
        console.log('Safety timeout triggered - forcing auth initialization');
        setAuthInitialized(true);
        setIsLoading(false);
      }
    }, 5000);
    
    // Get initial session without immediate navigation
    const getInitialSession = async () => {
      try {
        setIsLoading(true);
        console.log('Getting initial session...');
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!isComponentMounted) return;
        
        if (sessionData?.session) {
          // IMPORTANT: Do not consider users in recovery mode as "logged in"
          // This prevents them from being redirected to the main app
          const isRecoverySession = typeof window !== 'undefined' && 
                                    localStorage.getItem('isRecoverySession') === 'true';
          
          console.log('Session found, recovery session:', isRecoverySession);
          
          // Only consider the user logged in if it's NOT a recovery session
          const isLoggedInState = !isRecoverySession;
          setIsLoggedIn(isLoggedInState);
          
          // If logged in and not in recovery, sync data
          if (isLoggedInState) {
            try {
              // Don't await here - prevent blocking the auth flow
              syncAllData().catch(error => {
                console.error('Background sync error:', error);
              });
            } catch (syncError) {
              console.error('Error during initial data sync:', syncError);
              // Continue even if sync fails
            }
          }
        } else {
          console.log('No session found');
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (isComponentMounted) {
          setIsLoggedIn(false);
        }
      } finally {
        if (isComponentMounted) {
          // Mark as initialized, regardless of success/failure
          setAuthInitialized(true);
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    // Set up auth state change subscriber
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'Is recovery session:', localStorage.getItem('isRecoverySession'));
        
        // Skip if router not ready to prevent navigation errors
        if (!isRouterReady) {
          console.log('Router not ready, skipping navigation');
          return;
        }
        
        // Skip navigation for auth callback pages to prevent loops
        const currentPath = segments.join('/');
        const isAuthCallbackPage = currentPath.includes('auth/callback');
        
        if (isAuthCallbackPage) {
          console.log('In auth callback page, skipping navigation');
          return;
        }

        /**
         * CRITICAL: Password recovery handling
         * This handles both explicit PASSWORD_RECOVERY events and SIGNED_IN events from reset links
         * Both event types need special handling for recovery sessions
         */
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          // Check if there's a recovery marker in localStorage or URL
          const isRecoverySession = typeof window !== 'undefined' && 
                                   (localStorage.getItem('isRecoverySession') === 'true' ||
                                    window.location.href.includes('type=recovery'));
          
          if (isRecoverySession) {
            console.log('Password recovery session detected');
            
            // Mark this as a recovery session with all needed metadata
            if (typeof window !== 'undefined') {
              localStorage.setItem('isRecoverySession', 'true');
              localStorage.setItem('passwordResetTimestamp', Date.now().toString());
              if (session?.user?.email) {
                localStorage.setItem('passwordResetEmail', session.user.email);
                localStorage.setItem('hasValidSession', 'true');
              }
            }
            
            // IMPORTANT: Set as NOT logged in during recovery to prevent main app redirect
            setIsLoggedIn(false);
            
            // Force redirect to reset-password
            router.replace('/reset-password');
            return;
          }
        }
        
        // For non-recovery sessions, update logged in state and sync data
        const isAuthenticated = !!session;
        
        // Get recovery session status
        const isRecoverySession = typeof window !== 'undefined' && 
                                localStorage.getItem('isRecoverySession') === 'true';

        // Update login state based on session and recovery status
        setIsLoggedIn(isAuthenticated && !isRecoverySession);

        // If user just logged in and it's not a recovery session, sync data
        if (isAuthenticated && !isRecoverySession) {
          try {
            // Don't await here - sync in the background
            syncAllData().catch(error => {
              console.error('Background sync error:', error);
            });
          } catch (syncError) {
            console.error('Error during auth change data sync:', syncError);
            // Continue even if sync fails
          }
        }

        // Default protection - redirect based on auth state
        const isAuthGroup = segments[0] === '(auth)';
        
        if (session) {
          if (isRecoverySession) {
            // If this is a recovery session, force redirect to reset password
            if (!currentPath.includes('reset-password')) {
              console.log('Recovery session active, redirecting to reset password');
              router.replace('/reset-password');
            }
          } else if (isAuthGroup) {
            // Normal logged in state - redirect to app
            console.log('Redirecting to app tabs');
            router.replace('/(tabs)');
          }
        } else if (!session && !isAuthGroup) {
          // Not logged in, not on auth page, redirect to login
          console.log('Not logged in, redirecting to login');
          router.replace('/login');
        }
      }
    );

    return () => {
      isComponentMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [isRouterReady, router, segments, syncWatchlist, syncWatched]);

  return { isLoggedIn, isLoading, authInitialized };
}
