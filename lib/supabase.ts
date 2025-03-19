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
    
    return result;
  } catch (error: any) {
    console.error('Login error:', error.message || 'Unknown error');
    
    // Try one more time with the main client
    try {
      return await supabase.auth.signInWithPassword({ email, password });
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
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    return { data, error };
  } catch (error) {
    console.error('Registration error');
    return { data: { user: null, session: null }, error };
  }
}

// Initiate password reset
export async function resetPassword(email: string) {
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
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