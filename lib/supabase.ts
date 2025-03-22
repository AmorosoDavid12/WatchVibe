import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as constants from '../constants';

// Simple storage adapter for auth tokens
const AuthStorage = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`Error getting auth token: ${key}`);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`Error storing auth token: ${key}`);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Error removing auth token: ${key}`);
    }
  },
};

// Create a fresh Supabase client with proper headers
export const createFreshClient = () => {
  console.log('Creating fresh Supabase client with URL:', constants.SUPABASE_URL);
  return createClient(
    constants.SUPABASE_URL,
    constants.SUPABASE_ANON_KEY,
    {
      auth: {
        storage: AuthStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'apikey': constants.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        fetch: async (...args: any[]) => {
          // Add retry logic with exponential backoff
          const [url, options = {}] = args;
          const maxRetries = 2;
          let lastError;
          
          // Ensure headers are properly set
          if (!options.headers) {
            options.headers = {};
          }
          
          // Make sure apikey is always included
          options.headers = {
            ...options.headers,
            'apikey': constants.SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          };
          
          for (let i = 0; i <= maxRetries; i++) {
            try {
              if (i > 0) {
                // Wait before retry (exponential backoff)
                await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
              }
              
              return await fetch(url, options);
            } catch (error) {
              lastError = error;
            }
          }
          throw lastError;
        }
      }
    }
  );
};

// The main Supabase client instance
export const supabase = createFreshClient();

// Print connection info on startup 
console.log('Supabase client initialized with project ID:', constants.SUPABASE_PROJECT_ID);

// Get the current session directly from Supabase (server-first approach)
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session error:', error.message);
      return null;
    }
    
    return data?.session;
  } catch (error) {
    console.error('Failed to get session');
    return null;
  }
}

// Verify auth state and return if user is authenticated
export async function verifyAuthState(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null;
}

// Login with email and password
export async function login(email: string, password: string) {
  // Clear any existing tokens to ensure clean login
  await clearAuthTokens();
  
  // Create a fresh client for this login attempt
  const client = createFreshClient();
  
  try {
    // Primary login attempt with timeout
    const loginPromise = client.auth.signInWithPassword({
      email,
      password,
    });
    
    // Add timeout to prevent hanging
    const result = await Promise.race([
      loginPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout')), 10000)
      )
    ]) as any;
    
    // Check if there's an email confirmation error
    if (result.error) {
      console.log('Login error:', result.error.message);
      
      // Format error message for email not confirmed scenarios
      if (result.error.message?.includes('Email not confirmed') || 
          result.error.message?.includes('not confirmed') ||
          result.error.message?.includes('verify')) {
        console.log('Detected unconfirmed email during login attempt');
        
        // Return a more user-friendly error
        return {
          data: { user: null, session: null },
          error: { message: 'Please verify your email before logging in. Check your inbox for the verification link.' }
        };
      }
    }
    
    return result;
  } catch (error: any) {
    console.error('Login error:', error.message || 'Unknown error');
    
    // Try one more time with the main client
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      
      // Check for email verification issues in the retry as well
      if (result.error) {
        console.log('Login retry error:', result.error.message);
        
        if (result.error.message?.includes('Email not confirmed') || 
            result.error.message?.includes('not confirmed') ||
            result.error.message?.includes('verify')) {
          console.log('Detected unconfirmed email during login retry');
          
          // Return a more user-friendly error
          return {
            data: { user: null, session: null },
            error: { message: 'Please verify your email before logging in. Check your inbox for the verification link.' }
          };
        }
      }
      
      return result;
    } catch (retryError) {
      return { data: { user: null, session: null }, error };
    }
  }
}

// Clear auth tokens from storage
export async function clearAuthTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    const authKeys = [
      'sb-gihofdmqjwgkotwxdxms-auth-token',
      'sb-gihofdmqjwgkotwxdxms-auth-token-code-verifier',
      'supabase.auth.token',
    ];
    
    authKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
  }
}

// Logout user
export async function logout(): Promise<void> {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear tokens
    await clearAuthTokens();
    
    // Clear Zustand persisted state
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem('watchlist-storage');
        localStorage.removeItem('watched-storage');
        
        // Clear search state data
        localStorage.removeItem('search_query');
        localStorage.removeItem('search_active');
        localStorage.removeItem('selected_category');
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  } catch (error) {
    console.error('Logout error');
    // Continue anyway - cleanup is best effort
  }
}

// Register a new user
export async function register(email: string, password: string) {
  // Clear existing auth state
  await clearAuthTokens();
  
  console.log('Starting registration process for:', email);
  try {
    // For web, use the production URL to ensure consistent redirects
    // This should match the Site URL in Supabase dashboard settings
    const redirectUrl = Platform.OS === 'web' 
      ? `${constants.APP_URL}` 
      : `vibewatch://`;
      
    console.log('Using redirect URL:', redirectUrl);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        // Explicitly request email confirmation, even if not required by project settings
        data: {
          email_confirm_required: true
        }
      }
    });
    
    if (error) {
      console.error('Registration error:', error.message);
      return { data, error };
    } else {
      console.log('Registration successful, user created:', data?.user?.id);
      
      // Check if email confirmation is needed
      if (data?.user?.identities && data.user.identities.length === 0) {
        console.log('User already exists but email not confirmed');
        return { 
          data, 
          error: { message: 'This email is already registered but not confirmed. Please check your inbox for verification email.' } 
        };
      }
      
      // IMPORTANT: Force sign out the user after registration to enforce email verification
      console.log('Signing out user to enforce email verification flow');
      await supabase.auth.signOut();
      
      // Return a modified data object to indicate email verification is required
      return { 
        data: { 
          ...data, 
          session: null,  // Clear session to prevent immediate login
          emailVerificationRequired: true 
        }, 
        error: null 
      };
    }
  } catch (error) {
    console.error('Registration error:', error);
    return { data: { user: null, session: null }, error };
  }
}

// Initiate password reset
export async function resetPassword(email: string) {
  console.log('Initiating password reset for:', email);
  
  // Construct a proper redirect URL for production
  const redirectUrl = Platform.OS === 'web'
    ? `${constants.APP_URL}/reset-password`
    : 'vibewatch://reset-password';
    
  console.log('Using reset password redirect URL:', redirectUrl);
  
  const result = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  
  if (result.error) {
    console.error('Password reset error:', result.error.message);
  } else {
    console.log('Password reset email sent successfully');
  }
  
  return result;
}

// Resend verification email
export async function resendVerificationEmail(email: string) {
  try {
    console.log('Attempting to resend verification email to:', email);
    
    // We won't check if the email is already confirmed since we don't have admin access
    // Just call resend method with the appropriate parameters
    const redirectUrl = Platform.OS === 'web' 
      ? `${constants.APP_URL}` 
      : `vibewatch://`;
      
    console.log('Using redirect URL for verification:', redirectUrl);
    
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    if (error) {
      console.error('Resend verification error:', error.message);
    } else {
      console.log('Verification email resent successfully');
    }
    
    return { data, error };
  } catch (error) {
    console.error('Error resending verification email:', error);
    return { data: null, error };
  }
}

// Fetch data from Supabase with retry logic
export async function fetchWithRetry(
  tableName: string, 
  query: any,
  maxRetries = 2
) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      if (i > 0) {
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error fetching from ${tableName} (attempt ${i+1}/${maxRetries+1})`);
      lastError = error;
    }
  }
  
  throw lastError;
}

// Fetch user items (watchlist or watched)
export async function fetchUserItems(userId: string, type: 'watchlist' | 'watched') {
  if (!userId) return [];
  
  try {
    // Get current session to ensure we have a valid access token
    const session = await getCurrentSession();
    if (!session) {
      console.error('No valid session found for data fetch');
      return [];
    }
    
    // Create query with proper authorization
    const query = supabase
      .from('user_items')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('updated_at', { ascending: false });
    
    // Set authorization header for the request
    supabase.auth.setSession(session);
    
    const data = await fetchWithRetry('user_items', query);
    
    // Parse the items from JSON
    return data.map((row: any) => {
      try {
        return JSON.parse(row.value);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error(`Failed to fetch ${type} items`);
    return [];
  }
}

// Save item to user collection (watchlist or watched)
export async function saveUserItem(
  userId: string, 
  item: any, 
  type: 'watchlist' | 'watched'
) {
  if (!userId) return false;
  
  try {
    // Get current session to ensure we have a valid access token
    const session = await getCurrentSession();
    if (!session) {
      console.error('No valid session found for data save');
      return false;
    }
    
    // Set authorization header for the request
    supabase.auth.setSession(session);
    
    const { error } = await supabase
      .from('user_items')
      .upsert({
        user_id: userId,
        item_key: `${type}_${item.id}`,
        value: JSON.stringify(item),
        type,
        updated_at: new Date().toISOString()
      });
    
    return !error;
  } catch (error) {
    console.error(`Failed to save ${type} item`);
    return false;
  }
}

// Remove item from user collection
export async function removeUserItem(
  userId: string, 
  itemId: number, 
  type: 'watchlist' | 'watched'
) {
  if (!userId) return false;
  
  try {
    // Get current session to ensure we have a valid access token
    const session = await getCurrentSession();
    if (!session) {
      console.error('No valid session found for data removal');
      return false;
    }
    
    // Set authorization header for the request
    supabase.auth.setSession(session);
    
    const { error } = await supabase
      .from('user_items')
      .delete()
      .match({ 
        user_id: userId,
        item_key: `${type}_${itemId}`,
        type
      });
    
    return !error;
  } catch (error) {
    console.error(`Failed to remove ${type} item`);
    return false;
  }
}