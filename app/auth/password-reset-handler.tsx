import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function PasswordResetHandler() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Process the password reset token
    const handlePasswordReset = async () => {
      try {
        console.log("PasswordResetHandler: Starting token extraction");
        
        if (typeof window === 'undefined') {
          return; // This only works on web
        }
        
        // Clear any existing sessions immediately to prevent auto-login
        await supabase.auth.signOut();
        
        // Get URL parameters
        const url = window.location.href;
        console.log("PasswordResetHandler: URL =", url);
        
        // Extract token from hash or search params
        const hash = window.location.hash;
        const urlSearchParams = new URLSearchParams(window.location.search);
        
        // First check for tokens in the URL hash (typical Supabase format)
        let accessToken = null;
        let refreshToken = null;
        let type = null;
        
        if (hash && hash.includes('=')) {
          try {
            // Parse hash parameters
            const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
            
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
            type = hashParams.get('type');
            
            console.log("PasswordResetHandler: Found tokens in hash:", !!accessToken, !!refreshToken);
            console.log("PasswordResetHandler: Type:", type);
          } catch (e) {
            console.error("PasswordResetHandler: Error parsing hash", e);
          }
        }
        
        // Check URL search params for token
        const tokenFromUrl = urlSearchParams.get('token');
        const typeFromUrl = urlSearchParams.get('type');
        
        // Extract direct token from URL if present
        let directToken = null;
        if (url.includes('token=')) {
          try {
            const tokenMatch = url.match(/token=([^&]+)/);
            if (tokenMatch && tokenMatch[1]) {
              directToken = tokenMatch[1];
              console.log("PasswordResetHandler: Extracted direct token from URL");
            }
          } catch (e) {
            console.error("PasswordResetHandler: Error extracting direct token", e);
          }
        }
        
        // Determine which token to use
        const token = tokenFromUrl || directToken;
        const finalType = typeFromUrl || type;
        
        // Store tokens in localStorage
        if (token) {
          localStorage.setItem('passwordResetToken', token);
          localStorage.setItem('passwordResetTimestamp', Date.now().toString());
          
          // Also store email if available
          const email = urlSearchParams.get('email');
          if (email) {
            localStorage.setItem('passwordResetEmail', email);
          }
        }
        
        if (accessToken && refreshToken) {
          localStorage.setItem('passwordResetAccessToken', accessToken);
          localStorage.setItem('passwordResetRefreshToken', refreshToken);
        }
        
        // Mark this as a special reset flow
        localStorage.setItem('passwordResetSource', 'handlerBypass');
        
        // Redirect to the reset password page
        setTimeout(() => {
          router.replace('/reset-password?passwordReset=true&bypassAuth=true');
        }, 100);
        
      } catch (error) {
        console.error("PasswordResetHandler: Error processing reset:", error);
        setError("Error processing your password reset. Please try again.");
        
        // Safe fallback
        setTimeout(() => {
          router.replace('/forgot-password');
        }, 2000);
      }
    };
    
    handlePasswordReset();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6200ee" />
      <Text style={styles.text}>
        {error || "Processing your password reset..."}
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