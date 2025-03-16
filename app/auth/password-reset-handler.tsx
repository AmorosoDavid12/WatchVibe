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
        
        // Get URL parameters
        const url = window.location.href;
        console.log("PasswordResetHandler: URL =", url);
        
        // First, get the user's session
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Check if user has a valid session from Supabase verification
        if (sessionData?.session) {
          console.log("PasswordResetHandler: User has a session from Supabase verification");
          
          // Store the email
          if (sessionData.session.user?.email) {
            localStorage.setItem('passwordResetEmail', sessionData.session.user.email);
          }
          
          // Store user ID
          if (sessionData.session.user?.id) {
            localStorage.setItem('passwordResetUserId', sessionData.session.user.id);
          }
          
          // Explicitly sign the user out to force password reset flow
          console.log("PasswordResetHandler: Signing user out to force password reset flow");
          await supabase.auth.signOut();
          
          // Redirect to reset password page with special recovery flag
          setTimeout(() => {
            router.replace('/reset-password?passwordReset=true&userVerified=true');
          }, 100);
          return;
        }
        
        // If no auto-login session, try extraction methods...
        const hash = window.location.hash;
        const urlSearchParams = new URLSearchParams(window.location.search);
        
        // Check for token_hash in URL (directly from email link)
        const tokenHash = urlSearchParams.get('token_hash');
        const type = urlSearchParams.get('type') || 'recovery';
        
        // If we have a token_hash, use it to verify OTP
        if (tokenHash) {
          console.log("PasswordResetHandler: Found token_hash, verifying OTP");
          
          try {
            // Use verifyOtp to establish a session
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as any
            });
            
            if (error) {
              console.error("PasswordResetHandler: OTP verification error:", error);
              throw error;
            }
            
            if (data && data.session) {
              console.log("PasswordResetHandler: Successfully verified OTP and established session");
              
              // Store the email for the reset password page
              if (data.user?.email) {
                localStorage.setItem('passwordResetEmail', data.user.email);
              }
              
              // Store user ID
              if (data.user?.id) {
                localStorage.setItem('passwordResetUserId', data.user.id);
              }
              
              // Sign out to force password reset flow
              await supabase.auth.signOut();
              
              // Redirect to reset password page with flag indicating successful verification
              setTimeout(() => {
                router.replace('/reset-password?userVerified=true');
              }, 100);
              return;
            }
          } catch (verifyError) {
            console.error("PasswordResetHandler: Error during OTP verification:", verifyError);
          }
        }
        
        // Check for direct token in URL (from verification link)
        let directToken = null;
        if (url.includes('token=')) {
          try {
            const tokenMatch = url.match(/token=([^&]+)/);
            if (tokenMatch && tokenMatch[1]) {
              directToken = tokenMatch[1];
              console.log("PasswordResetHandler: Found direct token in URL");
              localStorage.setItem('passwordResetDirectToken', directToken);
              
              // Let the reset password page handle this
              setTimeout(() => {
                router.replace('/reset-password?passwordReset=true&directToken=true');
              }, 100);
              return;
            }
          } catch (e) {
            console.error("PasswordResetHandler: Error extracting direct token", e);
          }
        }
        
        // If we reached here, we couldn't find verification info
        // Redirect to reset password page for fallback handling
        setTimeout(() => {
          router.replace('/reset-password?passwordReset=true&fallback=true');
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