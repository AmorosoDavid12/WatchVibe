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

export const supabase = createClient(constants.SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucW53amR3d3FmZ2preG56cXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg5MzYzMDcsImV4cCI6MjAyNDUxMjMwN30.yTwkEX1bG6UPzlL2oJSOWF__PuMRQZQ8gRR7BzJLPc0', {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
    // Determine if we're running on web
    const isWeb = Platform.OS === 'web';
    
    // Get current origin for redirect URL
    const redirectUrl = `${constants.APP_URL}/auth/callback`;
    console.log('Using redirect URL:', redirectUrl);
    
    // Send the password reset email
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
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