import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    // This component handles auth callbacks including password reset
    async function handleCallback() {
      try {
        setProcessing(true);
        
        // Get the full URL including hash
        const url = window.location.href;
        
        // Parse hash parameters
        const hashParams = url.includes('#') ? 
          Object.fromEntries(
            url
              .split('#')[1]
              .split('&')
              .map(pair => pair.split('='))
          ) : {};
        
        // Handle different auth flows
        if (hashParams.type === 'recovery') {
          // Check for access_token which is needed for password reset
          if (!hashParams.access_token) {
            throw new Error('Password reset token not found in URL');
          }
          
          // Set the session server-side with the access token
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: hashParams.access_token,
            refresh_token: hashParams.refresh_token || '',
          });
          
          if (sessionError) {
            console.error('Error setting session:', sessionError);
            throw sessionError;
          }
          
          // Check if we now have a valid session
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            throw new Error('Failed to create a valid session');
          }
          
          // If everything is successful, redirect to reset password page
          router.replace('/reset-password');
        } else {
          // For other auth flows
          router.replace('/login');
        }
      } catch (err: any) {
        console.error('Error in auth callback:', err);
        setError(err.message || 'An error occurred during authentication');
        setProcessing(false);
      }
    }

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Authentication Error</Text>
        <Text style={styles.error}>{error}</Text>
        <Text 
          style={styles.link}
          onPress={() => router.replace('/login')}
        >
          Return to Login
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0000ff" />
      <Text style={styles.text}>Processing authentication...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  error: {
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  link: {
    color: 'blue',
    textDecorationLine: 'underline',
    marginTop: 20,
  }
}); 