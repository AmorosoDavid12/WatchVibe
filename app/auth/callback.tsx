import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface HashParams {
  [key: string]: string;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params.type as string;
  const error = params.error as string;
  const error_description = params.error_description as string;
  const [isProcessing, setIsProcessing] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log(`Auth state changed: ${event}`);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event detected');
        
        // Store info in localStorage
        if (typeof window !== 'undefined') {
          // Clear any previous reset data
          localStorage.removeItem('passwordResetEmail');
          localStorage.removeItem('passwordResetTimestamp');
          localStorage.removeItem('passwordResetUserId');
          localStorage.removeItem('hasValidSession');
          
          // Add recovery session flag
          localStorage.setItem('isRecoverySession', 'true');
          
          if (session?.user?.email) {
            localStorage.setItem('passwordResetEmail', session.user.email);
            localStorage.setItem('passwordResetTimestamp', Date.now().toString());
            
            if (session.user.id) {
              localStorage.setItem('passwordResetUserId', session.user.id);
            }
            
            // IMPORTANT: Flag that we have a valid session
            localStorage.setItem('hasValidSession', 'true');
            
            console.log('User data saved for password reset');
          }
        }
        
        // Redirect to reset-password with the session intact - don't sign out
        router.replace({
          pathname: '/reset-password',
          params: { 
            passwordReset: 'true',
            hasSession: 'true'
          }
        });
        
        return;
      }
      
      if (event === 'SIGNED_IN') {
        console.log('User signed in');
        
        // Check if this is a recovery session
        if (typeof window !== 'undefined' && localStorage.getItem('isRecoverySession') === 'true') {
          console.log('Recovery session detected, redirecting to reset password');
          router.replace('/reset-password');
          return;
        }
        
        // Normal sign in - redirect to home
        router.replace('/');
        return;
      }
    });
    
    // Parse the URL hash if present (from email links)
    const parseURLHash = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        console.log('Checking URL parameters');
        
        // Handle error if present
        if (error) {
          console.error(`Auth error: ${error}`, error_description);
          router.replace({
            pathname: '/login',
            params: { error: error_description || 'Authentication error' }
          });
          return;
        }
        
        // Handle password recovery in the URL (from emails)
        if (type === 'recovery') {
          console.log('Recovery link detected in URL');
          
          // Mark this as a recovery session
          localStorage.setItem('isRecoverySession', 'true');
          
          // Try to extract email from URL if present
          let email = null;
          if (params.email) {
            email = decodeURIComponent(params.email as string);
            console.log(`Email from URL: ${email}`);
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('passwordResetEmail', email);
              localStorage.setItem('passwordResetTimestamp', Date.now().toString());
            }
          }
          
          // Let the auth state change handler above deal with the actual redirect
          // This is needed because the EVENT might not fire yet
          if (typeof window !== 'undefined' && !localStorage.getItem('hasValidSession')) {
            // Redirect to reset-password if the auth event doesn't fire
            setTimeout(() => {
              router.replace({
                pathname: '/reset-password',
                params: { 
                  passwordReset: 'true'
                }
              });
            }, 1000);
          }
          
          return;
        }
      } catch (error) {
        console.error('Error parsing URL hash:', error);
        router.replace('/login');
      }
    };
    
    parseURLHash();
    
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [router, params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6200ee" />
      <Text style={styles.text}>
        {isProcessing 
          ? "Processing your authentication..." 
          : (errorState || "Redirecting...")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
  },
}); 