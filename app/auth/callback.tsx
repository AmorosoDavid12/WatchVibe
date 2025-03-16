import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    // This component handles auth callbacks including password reset
    async function handleCallback() {
      try {
        setProcessing(true);
        console.log('Auth callback - URL params:', params);
        
        // Get the full URL including query params
        const url = window.location.href;
        console.log('Full URL:', url);
        
        // Check if this is a recovery (password reset) flow
        const isRecovery = params.type === 'recovery' || url.includes('type=recovery');
        const urlParams = new URLSearchParams(window.location.search);
        const token = params.token || urlParams.get('token');
        
        if (isRecovery) {
          console.log('Detected password recovery flow');
          
          if (!token) {
            throw new Error('Password reset token not found in URL');
          }
          
          // Check if we have a valid session from the auth redirect
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('Valid session detected for password reset');
            // Redirect to the reset password page where user can set a new password
            router.replace('/reset-password');
          } else {
            console.log('No valid session, attempting to exchange token for session');
            // We might need to exchange the token for a session in some cases
            try {
              // This helps in some cases to create a valid recovery session
              const { error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'recovery',
              });
              
              if (verifyError) {
                console.error('Error verifying token:', verifyError);
              }
              
              // Redirect to reset password page even if there was an error
              // The reset page will handle checking for a valid session
              router.replace('/reset-password');
            } catch (err) {
              console.error('Error with token verification:', err);
              // Still try to redirect to reset password page
              router.replace('/reset-password');
            }
          }
        } else {
          // Handle hash fragment for other auth types (like OAuth)
          const hashParams = url.includes('#') ? 
            Object.fromEntries(
              url
                .split('#')[1]
                .split('&')
                .map(pair => pair.split('='))
            ) : {};
            
          // If we have an access token in the hash, try to set the session
          if (hashParams.access_token) {
            await supabase.auth.setSession({
              access_token: hashParams.access_token,
              refresh_token: hashParams.refresh_token || '',
            });
          }
          
          // For other auth flows, redirect to the home page
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        console.error('Error in auth callback:', err);
        setError(err.message || 'An error occurred during authentication');
        setProcessing(false);
      }
    }

    handleCallback();
  }, [router, params]);

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