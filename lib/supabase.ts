import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as constants from '../constants';

// Session manager to cache session and avoid multiple simultaneous requests
class SessionManager {
  private static instance: SessionManager;
  private sessionPromise: Promise<any> | null = null;
  private lastFetchTime: number = 0;
  private cachedSession: any = null;
  private sessionRefreshTimeout: any = null;
  private isRefreshing: boolean = false;

  // Session refresh interval (15 minutes)
  private REFRESH_INTERVAL = 15 * 60 * 1000; 
  // Minimum time between getSession calls (2 seconds)
  private MIN_FETCH_INTERVAL = 2000;
  
  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public async getSession(): Promise<any> {
    const now = Date.now();
    
    // If we have a recent cached session, return it immediately
    if (this.cachedSession && (now - this.lastFetchTime < this.MIN_FETCH_INTERVAL)) {
      console.log('Using cached session (recent)');
      return this.cachedSession;
    }
    
    // If there's already a session request in progress, return that promise
    if (this.sessionPromise && (now - this.lastFetchTime < this.MIN_FETCH_INTERVAL)) {
      console.log('Using in-progress session fetch');
      return this.sessionPromise;
    }
    
    // Otherwise, fetch a new session
    console.log('Fetching fresh session from auth provider');
    this.lastFetchTime = now;
    
    try {
      this.sessionPromise = supabase.auth.getSession();
      const result = await this.sessionPromise;
      this.cachedSession = result;
      
      // Schedule session refresh
      this.scheduleSessionRefresh();
      
      return result;
    } catch (error) {
      console.error('Error fetching session:', error);
      return { data: { session: null }, error };
    } finally {
      this.sessionPromise = null;
    }
  }
  
  public clearSession(): void {
    console.log('Clearing cached session');
    this.cachedSession = null;
    this.lastFetchTime = 0;
    if (this.sessionRefreshTimeout) {
      clearTimeout(this.sessionRefreshTimeout);
      this.sessionRefreshTimeout = null;
    }
  }
  
  private scheduleSessionRefresh(): void {
    // Clear any existing timeout
    if (this.sessionRefreshTimeout) {
      clearTimeout(this.sessionRefreshTimeout);
    }
    
    // Set a new timeout to refresh the session
    this.sessionRefreshTimeout = setTimeout(() => {
      this.refreshSession();
    }, this.REFRESH_INTERVAL);
  }
  
  private async refreshSession(): Promise<void> {
    if (this.isRefreshing) return;
    
    try {
      this.isRefreshing = true;
      console.log('Refreshing auth session...');
      const result = await supabase.auth.getSession();
      this.cachedSession = result;
      this.lastFetchTime = Date.now();
      console.log('Session refreshed successfully');
    } catch (error) {
      console.error('Error refreshing session:', error);
    } finally {
      this.isRefreshing = false;
      this.scheduleSessionRefresh();
    }
  }
}

// Enhanced storage adapter with better logging and error handling
const EnhancedStorageAdapter = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        const data = localStorage.getItem(key);
        console.log(`Retrieved key ${key} from localStorage`);
        return data;
      }
      const data = await SecureStore.getItemAsync(key);
      console.log(`Retrieved key ${key} from SecureStore`);
      return data;
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        console.log(`Stored key ${key} in localStorage`);
        return;
      }
      await SecureStore.setItemAsync(key, value);
      console.log(`Stored key ${key} in SecureStore`);
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        console.log(`Removed key ${key} from localStorage`);
        return;
      }
      await SecureStore.deleteItemAsync(key);
      console.log(`Removed key ${key} from SecureStore`);
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
    }
  },
};

// Create Supabase client with enhanced options
export const supabase = createClient(
  constants.SUPABASE_URL,
  constants.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: EnhancedStorageAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    // Add global fetch parameters to help with CORS and auth
    global: {
      fetch: async (...args: any[]) => {
        const [url, options = {}] = args;

        // Get the current session access token if available
        let accessToken = constants.SUPABASE_ANON_KEY;
        try {
          const { data } = await SessionManager.getInstance().getSession();
          if (data?.session?.access_token) {
            accessToken = data.session.access_token;
            console.log('Using user access token for request');
          } else {
            console.log('Using anon key for request');
          }
        } catch (error) {
          console.error('Error getting session for request:', error);
        }

        // Ensure API key and auth token are included for all API calls
        const fetchOptions = {
          ...options,
          headers: {
            ...options.headers,
            'Accept': 'application/json',
            'apikey': constants.SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
            'Authorization': `Bearer ${accessToken}`
          },
        };

        return fetch(url, fetchOptions);
      }
    }
  }
);

// Export a function to get the current session with debug info
export async function getCurrentSession() {
  try {
    console.log('Getting current auth session...');
    const result = await SessionManager.getInstance().getSession();
    
    if (result.data?.session) {
      console.log('Session found:', {
        user: result.data.session.user.email,
        expires_at: result.data.session.expires_at ? 
          new Date(result.data.session.expires_at * 1000).toLocaleString() : 'unknown'
      });
      return result.data.session;
    } else {
      console.log('No session found');
      return null;
    }
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function login(email: string, password: string) {
  try {
    console.log(`Logging in user ${email}...`);
    
    // First, clear any existing session if there is one
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sb-gihofdmqjwgkotwxdxms-auth-token');
      localStorage.removeItem('sb-gihofdmqjwgkotwxdxms-auth-token-code-verifier');
    }
    
    // Clear any cached session
    SessionManager.getInstance().clearSession();
    
    const result = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    
    if (result.error) {
      console.error('Login error:', result.error);
    } else {
      console.log('Login successful:', {
        user: result.data?.user?.email,
        session_expires_at: result.data?.session?.expires_at
          ? new Date(result.data.session.expires_at * 1000).toLocaleString()
          : 'unknown'
      });
    }
    
    return result;
  } catch (error) {
    console.error('Unexpected error during login:', error);
    return { data: { user: null, session: null }, error };
  }
}

/**
 * Logs the user out by clearing their session
 * @param currentDeviceOnly If true, only signs out from the current device. Default is false (all devices).
 */
export const logout = async (currentDeviceOnly: boolean = false): Promise<void> => {
  try {
    console.log('Logging out user...');
    
    // Clear cached session first for immediate UI response
    SessionManager.getInstance().clearSession();
    
    // Sign out with the specified scope
    const scope = currentDeviceOnly ? 'local' : 'global';
    await supabase.auth.signOut({ scope });
    
    console.log(`User signed out successfully (scope: ${scope})`);
    
    // Clean up any lingering data
    return Promise.resolve();
  } catch (error) {
    console.error('Error in logout:', error);
    // Even if there's an error, we want to clear the UI state
    return Promise.resolve();
  }
};

export async function register(email: string, password: string) {
  console.log(`Registering user ${email}...`);
  
  // Clear any cached session
  SessionManager.getInstance().clearSession();
  
  return await supabase.auth.signUp({
    email: email,
    password: password,
  });
}

// Add consistent alias for register function to match naming in register.tsx
export const signUpWithEmail = register;

export async function resetPassword(email: string) {
  try {
    // Sign out from current device only, so users can stay logged in on other devices
    await supabase.auth.signOut({
      scope: 'local'
    });

    // Clear any cached session
    SessionManager.getInstance().clearSession();

    console.log("Reset password for email:", email);

    // Use a two-step approach with a special route that will handle the token without auto-login

    // First, redirect to our auth/password-reset-handler, which then redirects to reset-password

    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/password-reset-handler`
      : 'http://localhost:8081/auth/password-reset-handler';

    console.log("Using redirect URL:", redirectUrl);

    // Send the reset password email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      console.error("Reset password error:", error);
      throw error;
    }

    return { error: null };
  } catch (error) {
    console.error("Reset password exception:", error);
    return { error };
  }
}

export async function updatePassword(password: string) {
  const result = await supabase.auth.updateUser({
    password: password,
  });
  
  // Clear and refresh the session cache after password update
  SessionManager.getInstance().clearSession();
  
  return result;
}

export async function signInWithGoogle() {
  // Clear any cached session
  SessionManager.getInstance().clearSession();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: constants.APP_URL,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return { data, error };
}

// Add a utility function to initialize data stores after authentication
export async function initializeUserData() {
  const session = await getCurrentSession();
  if (!session) {
    console.log('No active session, skipping data initialization');
    return false;
  }
  
  console.log('Initializing user data...');
  // This function will be called after successful login to ensure
  // that user-specific data is properly initialized
  return true;
}

// Add a utility function to clear all auth tokens
export function clearAuthTokens() {
  try {
    console.log('Clearing all authentication tokens...');
    
    if (typeof window !== 'undefined') {
      // Remove Supabase tokens
      localStorage.removeItem('sb-gihofdmqjwgkotwxdxms-auth-token');
      localStorage.removeItem('sb-gihofdmqjwgkotwxdxms-auth-token-code-verifier');
      
      // Remove other auth-related tokens
      localStorage.removeItem('passwordResetEmail');
      localStorage.removeItem('passwordResetTimestamp');
      localStorage.removeItem('isRecoverySession');
      localStorage.removeItem('hasValidSession');
      localStorage.removeItem('passwordResetUserId');
      localStorage.removeItem('loggingOut');
      
      console.log('Auth tokens cleared successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error clearing auth tokens:', error);
    return false;
  }
}

// Add a new helper function to check and refresh auth status
export async function verifyAuthState(): Promise<boolean> {
  try {
    console.log('Verifying authentication state...');
    const session = await getCurrentSession();
    
    if (!session) {
      console.log('No valid session found');
      return false;
    }
    
    // Check if token is expired or will expire soon (within 5 minutes)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60;
    
    if (expiresAt && expiresAt < now + fiveMinutes) {
      console.log('Session expired or expiring soon, refreshing...');
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('Failed to refresh session:', error);
          return false;
        }
        console.log('Session refreshed successfully');
        SessionManager.getInstance().clearSession();
        return !!data.session;
      } catch (refreshError) {
        console.error('Error during session refresh:', refreshError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying auth state:', error);
    return false;
  }
}