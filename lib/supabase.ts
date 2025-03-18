import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as constants from '../constants';

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
      detectSessionInUrl: true,
    },
    // Add global fetch parameters to help with CORS and auth
    global: {
      fetch: async (...args: any[]) => {
        const [url, options = {}] = args;
        
        // Get the current session access token if available
        let accessToken = constants.SUPABASE_ANON_KEY;
        try {
          const { data } = await supabase.auth.getSession();
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
    const result = await supabase.auth.getSession();
    
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
  console.log(`Logging in user ${email}...`);
  const result = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
  
  if (result.error) {
    console.error('Login error:', result.error);
  } else {
    console.log('Login successful');
  }
  
  return result;
}

export async function logout() {
  console.log('Logging out...');
  try {
    // Mark that we're in the middle of logging out to prevent navigation loops
    if (typeof window !== 'undefined') {
      localStorage.setItem('loggingOut', 'true');
    }
    
    // Clear localStorage directly first to ensure client state is cleared immediately
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sb-gihofdmqjwgkotwxdxms-auth-token');
      localStorage.removeItem('sb-gihofdmqjwgkotwxdxms-auth-token-code-verifier');
      localStorage.removeItem('passwordResetEmail');
      localStorage.removeItem('passwordResetTimestamp');
      localStorage.removeItem('isRecoverySession');
      localStorage.removeItem('hasValidSession');
      localStorage.removeItem('passwordResetUserId');
    }
    
    // Set a timeout to ensure we don't hang
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => {
        console.log('Logout API call timed out, continuing anyway');
        return resolve({ error: null }); // Return success even on timeout
      }, 2000)
    );
    
    // Attempt to clear session on server, but don't wait if it takes too long
    const signOutPromise = supabase.auth.signOut();
    
    // Use race to avoid hanging
    const result = await Promise.race([signOutPromise, timeoutPromise]);
    
    // Clear the logout in progress marker
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loggingOut');
    }
    
    return result;
  } catch (error) {
    console.error('Error in logout:', error);
    
    // Clear the logout in progress marker
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loggingOut');
    }
    
    // Return success even if there's an error
    return { error: null };
  }
}

export async function register(email: string, password: string) {
  console.log(`Registering user ${email}...`);
  return await supabase.auth.signUp({
    email: email,
    password: password,
  });
}

// Add consistent alias for register function to match naming in register.tsx
export const signUpWithEmail = register;

export async function resetPassword(email: string) {
  try {
    // Sign out first to clear any existing session
    await supabase.auth.signOut();
    
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
  return await supabase.auth.updateUser({
    password: password,
  });
}

export async function signInWithGoogle() {
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