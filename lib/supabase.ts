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
  try {
    // Sign out first to clear any existing session
    await supabase.auth.signOut();
    
    console.log("Reset password for email:", email);
    
    // Build the redirect URL to go directly to the reset password page
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/reset-password`  // Direct to reset-password page
      : 'http://localhost:8081/reset-password';     // Fallback for React Native
    
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