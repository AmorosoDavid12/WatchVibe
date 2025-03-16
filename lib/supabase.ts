import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as constants from '../constants';

// Implement platform-specific storage adapter
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem(key);
      return Promise.resolve(data);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Create Supabase client with additional options for web
export const supabase = createClient(
  constants.SUPABASE_URL, 
  constants.SUPABASE_ANON_KEY, 
  {
    auth: {
      storage: ExpoSecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    // Add global fetch parameters to help with CORS
    global: {
      fetch: (...args) => {
        // Add headers to help with CORS if on web
        if (Platform.OS === 'web') {
          const [url, options = {}] = args;
          // Ensure API key is included for REST API calls
          const fetchOptions = {
            ...options,
            headers: {
              ...options.headers,
              'Accept': 'application/json',
              'apikey': constants.SUPABASE_ANON_KEY,
            },
          };
          return fetch(url, fetchOptions);
        }
        return fetch(...args);
      }
    }
  }
);

export async function login(email: string, password: string) {
  return await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
}

export async function logout() {
  return await supabase.auth.signOut();
}

export async function register(email: string, password: string) {
  return await supabase.auth.signUp({
    email: email,
    password: password,
  });
}

export async function resetPassword(email: string) {
  // Sign out first to clear any existing sessions
  await supabase.auth.signOut();
  
  try {
    console.log('Attempting to reset password for email:', email);
    
    // We'll change the approach entirely - use a direct login link instead of reset
    // This will set flags that we can use to detect the reset flow without token parsing
    const redirectUrl = `${constants.APP_URL}/login?source=password_reset&email=${encodeURIComponent(email)}`;
    console.log('Using redirect URL:', redirectUrl);
    
    // Send a magic link email instead of a password reset
    const result = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      }
    });
    
    console.log('Magic link email sent:', result);
    return {
      data: { ...result.data, method: 'magic_link' },
      error: result.error
    };
  } catch (error) {
    console.error('Error during password reset:', error);
    throw error;
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