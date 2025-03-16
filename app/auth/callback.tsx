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
        
        // Get the full URL including hash and search params
        const url = window.location.href;
        console.log('Full URL:', url);
        
        // Check URL Search Params first (for verification links)
        const urlSearchParams = new URLSearchParams(window.location.search);
        const token = urlSearchParams.get('token');
        const type = urlSearchParams.get('type');
        
        console.log('URL Search Params - token:', !!token, 'type:', type);
        
        // Then check hash params (for other auth flows)
        const hashParams = url.includes('#') ? 
          Object.fromEntries(
            url
              .split('#')[1]
              .split('&')
              .map(pair => pair.split('='))
          ) : {};
        
        console.log('Hash params:', hashParams);
        
        // Determine if this is a recovery flow - check multiple places
        const isRecovery = 
          type === 'recovery' || 
          params.type === 'recovery' || 
          hashParams.type === 'recovery' || 
          url.includes('type=recovery');
                          
        console.log('Is recovery flow:', isRecovery);
        
        // Get token from various possible locations
        const accessToken = 
          token || 
          params.token || 
          hashParams.access_token;
        
        console.log('Token present:', !!accessToken);
        
        if (isRecovery) {
          console.log('Handling password recovery flow');
          
          if (!accessToken) {
            throw new Error('Password reset token not found in URL');
          }
          
          // For verification links, we need to redirect directly to reset-password
          // WITHOUT setting the session first (which would log the user in)
          if (type === 'recovery' && token) {
            console.log('Detected direct verification link, redirecting to reset-password');
            router.replace('/reset-password');
            return;
          }
          
          // For hash fragments with access tokens
          if (hashParams.access_token) {
            console.log('Setting session with hash access token');
            // We may need to set the session to get access
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: hashParams.access_token,
              refresh_token: hashParams.refresh_token || '',
            });
            
            if (sessionError) {
              console.error('Error setting session:', sessionError);
            }
          }
          
          // Check if we have a valid session
          const { data: sessionData } = await supabase.auth.getSession();
          console.log('Session check result:', sessionData?.session ? 'Valid session' : 'No session');
          
          // Regardless of session status, redirect to reset-password
          // The reset-password page will verify if the session is valid
          console.log('Redirecting to reset password page');
          router.replace('/reset-password');
        } else {
          // Handle other auth types (like OAuth)
          console.log('Handling non-recovery auth flow');
          
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