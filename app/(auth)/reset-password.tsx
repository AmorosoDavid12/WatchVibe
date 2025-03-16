import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock, ArrowLeft } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [isValidResetRequest, setIsValidResetRequest] = useState(false);
  const [isCheckingReset, setIsCheckingReset] = useState(true);
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Check if this is a valid password reset request
  useEffect(() => {
    const checkResetRequest = async () => {
      try {
        console.log("ResetPassword: Checking for valid reset request");
        
        if (typeof window === 'undefined') {
          setIsCheckingReset(false);
          return;
        }
        
        // Get info from localStorage
        const storedEmail = localStorage.getItem('passwordResetEmail');
        const storedUserId = localStorage.getItem('passwordResetUserId');
        
        // Set user info if available
        if (storedEmail) {
          setEmail(storedEmail);
        }
        
        if (storedUserId) {
          setUserId(storedUserId);
        }
        
        // Check for userVerified flag from password-reset-handler
        const userVerified = params.userVerified === 'true';
        if (userVerified) {
          console.log("ResetPassword: User was verified by Supabase but signed out to allow password reset");
          setIsValidResetRequest(true);
          setIsCheckingReset(false);
          return;
        }
        
        // Check for direct token from a verification link
        const directToken = params.directToken === 'true';
        if (directToken) {
          console.log("ResetPassword: Direct token was found and stored");
          setIsValidResetRequest(true);
          setIsCheckingReset(false);
          return;
        }
        
        // Check if this is a fallback from password-reset-handler
        const fallback = params.fallback === 'true';
        if (fallback) {
          console.log("ResetPassword: Fallback from password-reset-handler");
          // If we have email/userId, accept the request
          if (storedEmail || storedUserId) {
            setIsValidResetRequest(true);
            setIsCheckingReset(false);
            return;
          }
        }
        
        // Check if we have a normal passwordReset flag
        const passwordReset = params.passwordReset === 'true';
        if (passwordReset) {
          console.log("ResetPassword: Normal password reset flow");
          setIsValidResetRequest(true);
          setIsCheckingReset(false);
          return;
        }
        
        // If we reach here, no valid reset request
        console.log("ResetPassword: No valid reset request found");
        setError("No active reset request found. Please request a new password reset link.");
        setIsCheckingReset(false);
        
      } catch (err) {
        console.error("ResetPassword: Error checking reset request:", err);
        setError("Error checking your reset request. Please try again.");
        setIsCheckingReset(false);
      }
    };
    
    checkResetRequest();
  }, [params]);

  // Function to handle requesting a new reset link
  const handleRequestNewLink = () => {
    router.replace('/forgot-password');
  };

  async function handleUpdatePassword() {
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!email && !userId) {
      setError('Unable to identify your account. Please request a new password reset link.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    
    try {
      console.log("ResetPassword: Starting password update");
      
      // Try the admin update method first if we have a user ID
      if (userId) {
        console.log("ResetPassword: Using userId to update password:", userId);
        
        // For user ID approach, we need to make our own API call to the backend
        // since user isn't logged in and needs admin privileges
        // This will be a placeholder - in a real implementation, you'd make a call to your server
        
        // For now, we'll check if the user can sign in with the stored email and then update
        if (email) {
          try {
            // First try to request a new password reset and get a fresh token
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + '/auth/password-reset-handler'
            });
            
            if (resetError) {
              console.error("ResetPassword: Error requesting new reset:", resetError);
              throw resetError;
            }
            
            // Show a success message - the user will need to check their email again
            console.log("ResetPassword: Sent a new password reset email");
            setSuccessMessage("We've sent you a new password reset link. Please check your email to complete the reset process.");
            setPasswordResetComplete(true);
            
            // Clean up localStorage
            cleanupLocalStorage();
            
            // Wait before redirecting
            setTimeout(() => {
              router.replace('/login');
            }, 5000);
            
            return;
          } catch (e) {
            console.error("ResetPassword: Error in email reset flow:", e);
            throw e;
          }
        }
      }
      
      // If no user ID or the above approach failed, try standard password reset
      if (email) {
        console.log("ResetPassword: Sending new password reset email to:", email);
        
        // Request a new password reset email
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth/password-reset-handler'
        });
        
        if (resetError) {
          console.error("ResetPassword: Error requesting password reset:", resetError);
          throw resetError;
        }
        
        console.log("ResetPassword: Password reset email sent successfully");
        setSuccessMessage("We've sent you a new password reset link. Please check your email to complete the reset process.");
        setPasswordResetComplete(true);
        
        // Clean up localStorage
        cleanupLocalStorage();
        
        // Wait before redirecting
        setTimeout(() => {
          router.replace('/login');
        }, 5000);
        
        return;
      }
      
      // If we get here, we couldn't update the password
      setError("Unable to update your password. Please request a new reset link.");
      setLoading(false);
      
    } catch (error: any) {
      console.error("ResetPassword: Error in password update:", error);
      
      // Special handling for rate limit errors
      if (error.message && error.message.includes('security purposes')) {
        setError('Too many requests. Please wait a minute and try again.');
      } else if (error.message && (error.message.includes('expired') || error.message.includes('invalid'))) {
        setError('Your reset link has expired or is invalid. Please request a new one.');
      } else {
        setError(error.message || 'Failed to update password');
      }
      
      setLoading(false);
    }
  }
  
  function cleanupLocalStorage() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('passwordResetDirectToken');
      localStorage.removeItem('passwordResetEmail');
      localStorage.removeItem('passwordResetUserId');
      localStorage.removeItem('passwordResetTimestamp');
    }
  }

  if (isCheckingReset) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#fff' }}>Verifying your reset request...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          {!isValidResetRequest ? 'Reset Link Expired' : (passwordResetComplete ? 'Check Your Email' : 'Create New Password')}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {!isValidResetRequest 
            ? 'Your reset link has expired or is invalid'
            : (passwordResetComplete 
                ? 'Please check your email for a secure link to set your new password' 
                : 'Enter your new password below')}
        </Text>

        {error && (
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
        )}

        {successMessage && (
          <HelperText type="info" visible={!!successMessage} style={styles.successMessage}>
            {successMessage}
          </HelperText>
        )}
        
        {isValidResetRequest && !passwordResetComplete ? (
          <>
            {/* Only show the email field if it's not pre-filled */}
            {!email && (
              <TextInput
                mode="outlined"
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(null);
                }}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                error={!!error && !email}
              />
            )}
            
            <TextInput
              mode="outlined"
              label="New Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              style={styles.input}
              secureTextEntry={secureTextEntry}
              left={<TextInput.Icon icon={() => <Lock size={20} color="#888" />} />}
              right={<TextInput.Icon icon={secureTextEntry ? "eye" : "eye-off"} onPress={() => setSecureTextEntry(!secureTextEntry)} />}
              error={!!error && !password}
            />
            
            <TextInput
              mode="outlined"
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError(null);
              }}
              style={styles.input}
              secureTextEntry={secureConfirmTextEntry}
              left={<TextInput.Icon icon={() => <Lock size={20} color="#888" />} />}
              right={<TextInput.Icon icon={secureConfirmTextEntry ? "eye" : "eye-off"} onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)} />}
              error={!!error && (!confirmPassword || password !== confirmPassword)}
            />
            
            <Button 
              mode="contained" 
              onPress={handleUpdatePassword}
              style={styles.button}
              loading={loading}
              disabled={loading}
            >
              Update Password
            </Button>
          </>
        ) : !passwordResetComplete && (
          <Button 
            mode="contained" 
            onPress={handleRequestNewLink}
            style={styles.button}
          >
            Request New Link
          </Button>
        )}

        {passwordResetComplete && (
          <Text style={styles.redirectingText}>
            Redirecting to login...
          </Text>
        )}
        
        <TouchableOpacity 
          onPress={() => router.push('/login')}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color="#888" />
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#121212',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 20,
    borderRadius: 8,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  backButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    marginLeft: 8,
    color: '#888',
  },
  successMessage: {
    color: 'green',
    marginBottom: 16,
  },
  redirectingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
}); 