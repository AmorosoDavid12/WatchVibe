import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we're handling a password reset
        const isReset = params.reset === 'true';
        const hash = window.location.hash;
        
        if (isReset) {
          // For password reset, we need to extract token
          if (hash && hash.includes('access_token')) {
            // Process the hash but don't redirect yet - this stores the session
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error('Session error:', error.message);
              setError('Failed to establish session. Please try again.');
            } else if (data.session) {
              // Success! Now redirect to the reset password form
              router.replace('/reset-password');
            } else {
              setError('No session data found. Please request a new reset link.');
            }
          } else if (hash && hash.includes('error')) {
            // There was an error in the hash
            const hashParams = new URLSearchParams(hash.substring(1));
            const errorCode = hashParams.get('error_code');
            const errorDesc = hashParams.get('error_description');
            
            setError(`Authentication error: ${errorDesc || errorCode || 'Unknown error'}`);
            
            // Still redirect to reset password page which will show the expired token UI
            setTimeout(() => {
              router.replace('/reset-password');
            }, 1500);
          } else {
            // No token found but we're in callback
            setError('No authentication token found. Please try again.');
          }
        } else {
          // Not a password reset flow, just process the session
          await supabase.auth.getSession();
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [params, router]);

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color="#e21f70" />
          <Text style={styles.loadingText}>Processing authentication...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  errorText: {
    color: '#ff5252',
    textAlign: 'center',
    fontSize: 16,
  },
}); 