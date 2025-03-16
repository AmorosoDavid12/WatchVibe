import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface HashParams {
  [key: string]: string;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Add a small delay to ensure router is ready
    const timer = setTimeout(() => {
      handleCallback();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleCallback = async () => {
    try {
      console.log("AuthCallback: Processing callback");

      // FULL URL DIAGNOSTICS
      if (typeof window !== 'undefined') {
        console.log("AuthCallback: FULL DIAGNOSTICS");
        console.log("AuthCallback: COMPLETE URL =", window.location.href);
        console.log("AuthCallback: pathname =", window.location.pathname);
        console.log("AuthCallback: search =", window.location.search);
        console.log("AuthCallback: hash =", window.location.hash);
      }

      // First check for search params
      const url = window.location.href;
      const urlSearchParams = new URLSearchParams(window.location.search);
      
      // Extract token directly from the full URL if present
      let directToken = null;
      if (url.includes('token=')) {
        try {
          const tokenMatch = url.match(/token=([^&]+)/);
          if (tokenMatch && tokenMatch[1]) {
            directToken = tokenMatch[1];
            console.log("AuthCallback: Extracted direct token from URL");
          }
        } catch (e) {
          console.error("AuthCallback: Error extracting direct token", e);
        }
      }
      
      // Check URL hash for tokens or recovery type
      const hash = window.location.hash;
      let hashParams: HashParams = {};
      
      if (hash && hash.includes('=')) {
        // Handle possible URL encoding in the hash
        const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
        
        try {
          // Try to parse as standard URL params
          hashParams = Object.fromEntries(
            cleanHash.split('&').map(pair => {
              const [key, value] = pair.split('=');
              return [key, decodeURIComponent(value || '')];
            })
          );
          
          console.log("AuthCallback: Found hash params:", Object.keys(hashParams));
        } catch (e) {
          console.error("AuthCallback: Error parsing hash", e);
        }
      }
      
      // Check if URL contains reset=true or type=recovery for password reset
      const isReset = urlSearchParams.get('reset') === 'true' || 
                      hashParams.type === 'recovery' ||
                      url.includes('type=recovery');
      
      // Handle password reset redirect first - highest priority
      if (isReset) {
        console.log("AuthCallback: Password RESET flow detected");
        
        // Check for tokens in both URL search, direct URL, and hash
        const token = urlSearchParams.get('token') || directToken || hashParams.token || hashParams.access_token;
        
        if (token) {
          console.log("AuthCallback: Found reset token, storing for use");
          // Store token in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('passwordResetToken', token);
            localStorage.setItem('passwordResetTimestamp', Date.now().toString());
            
            // Also store any email if available
            const email = urlSearchParams.get('email') || hashParams.email;
            if (email) {
              localStorage.setItem('passwordResetEmail', email);
            }
            
            // Store complete token data
            const tokenData = {
              token: token,
              type: 'recovery',
              timestamp: Date.now()
            };
            localStorage.setItem('passwordResetData', JSON.stringify(tokenData));
          }
        }
        
        // Set processing to false before navigation
        setIsProcessing(false);
        
        try {
          // Redirect to reset password page
          console.log("AuthCallback: Redirecting to reset-password");
          
          // Use a more conservative approach with linking
          setTimeout(() => {
            router.replace('/reset-password?passwordReset=true');
          }, 100);
          
          return;
        } catch (navError) {
          console.error("AuthCallback: Navigation error:", navError);
          setError("Navigation error. Please go to the reset password page manually.");
          return;
        }
      }
      
      // For normal authentication (non-password reset)
      console.log("AuthCallback: Standard auth flow detected");
      
      // Check for access token in hash
      const accessToken = hashParams.access_token;
      const refreshToken = hashParams.refresh_token;
      
      if (accessToken && refreshToken) {
        console.log("AuthCallback: Setting session with token");
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          throw new Error('Error setting session: ' + error.message);
        }
      }
      
      // Check current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }
      
      // Set processing to false before navigation
      setIsProcessing(false);
      
      try {
        if (session) {
          console.log("AuthCallback: Session confirmed, redirecting to home");
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 100);
        } else {
          // No session found
          console.log("AuthCallback: No session found, redirecting to login");
          setTimeout(() => {
            router.replace('/login');
          }, 100);
        }
      } catch (navError) {
        console.error("AuthCallback: Navigation error:", navError);
        setError("Navigation error. Please go to the home or login page manually.");
      }
    } catch (error) {
      console.error('Error in auth callback:', error);
      setIsProcessing(false);
      setError("Authentication error. Please try again.");
      
      // Safe fallback navigation
      setTimeout(() => {
        try {
          router.replace('/login');
        } catch (e) {
          console.error("Fallback navigation failed:", e);
        }
      }, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6200ee" />
      <Text style={styles.text}>
        {isProcessing 
          ? "Processing your authentication..." 
          : (error || "Redirecting...")}
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