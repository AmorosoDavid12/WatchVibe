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
  const [hasSession, setHasSession] = useState(false);
  
  // Check if this is a valid password reset request
  useEffect(() => {
    const checkResetRequest = async () => {
      try {
        console.log("ResetPassword: Checking for valid reset request");
        
        if (typeof window === 'undefined') {
          setIsCheckingReset(false);
          return;
        }
        
        // First check for session flag from password-reset-handler
        const hasSessionFlag = params.hasSession === 'true';
        const storedHasSession = localStorage.getItem('hasValidSession') === 'true';
        
        if (hasSessionFlag || storedHasSession) {
          console.log("ResetPassword: We have a valid Supabase session");
          setHasSession(true);
          
          // Actually check for the session
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log("ResetPassword: Confirmed valid session exists");
            
            // Set email from session
            if (sessionData.session.user?.email) {
              setEmail(sessionData.session.user.email);
            }
          } else {
            console.log("ResetPassword: Session flag found but no actual session");
          }
        }
        
        // Get info from localStorage as fallback
        const storedEmail = localStorage.getItem('passwordResetEmail');
        
        // Set email if available and not already set
        if (storedEmail && !email) {
          setEmail(storedEmail);
        }
        
        // Check if we have a normal passwordReset flag
        const passwordReset = params.passwordReset === 'true';
        if (passwordReset || hasSessionFlag || storedHasSession) {
          console.log("ResetPassword: Valid reset request found");
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

    if (!email) {
      setError('Email address is required.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    
    try {
      console.log("ResetPassword: Starting password update");
      
      // Simple approach: Try to update user directly
      console.log("ResetPassword: Attempting direct password update");
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });
      
      if (!updateError) {
        // Success!
        console.log("ResetPassword: Password updated successfully");
        handlePasswordUpdateSuccess();
        return;
      }
      
      // If direct update failed, log the error
      console.error("ResetPassword: Direct update failed:", updateError);
      
      // If user has a valid session but update failed, something else is wrong
      if (hasSession) {
        throw new Error("Unable to update password with your session. Try requesting a new reset link.");
      }
      
      // At this point, we don't have a valid session
      console.log("ResetPassword: No valid session, trying alternatives");
      
      // Try to reset password with email
      if (email) {
        console.log("ResetPassword: Sending new reset email as fallback");
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth/password-reset-handler'
        });
        
        if (resetError) {
          console.error("ResetPassword: Error requesting password reset:", resetError);
          throw resetError;
        }
        
        // Success!
        console.log("ResetPassword: Reset email sent successfully");
        setSuccessMessage("We've sent you a new password reset link. Please check your email to complete the reset process.");
        setPasswordResetComplete(true);
        
        // Clean up localStorage
        cleanupLocalStorage();
        
        // Wait before redirecting
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
        
        return;
      }
      
      // If we reach here, we couldn't update the password
      throw new Error("Unable to update your password. Please request a new reset link.");
      
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
  
  function handlePasswordUpdateSuccess() {
    console.log("ResetPassword: Password updated successfully");
    setSuccessMessage('Your password has been updated successfully!');
    setPasswordResetComplete(true);
    
    // Clean up localStorage
    cleanupLocalStorage();
    
    // Wait a moment before redirecting to login
    setTimeout(() => {
      // Sign out first to clear any session
      supabase.auth.signOut().then(() => {
        router.replace('/login');
      });
    }, 3000);
  }
  
  function cleanupLocalStorage() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('passwordResetToken');
      localStorage.removeItem('passwordResetType');
      localStorage.removeItem('passwordResetEmail');
      localStorage.removeItem('passwordResetTimestamp');
      localStorage.removeItem('passwordResetUserId');
      localStorage.removeItem('hasValidSession');
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
          {!isValidResetRequest ? 'Reset Link Expired' : (passwordResetComplete ? 'Password Updated' : 'Create New Password')}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {!isValidResetRequest 
            ? 'Your reset link has expired or is invalid'
            : (passwordResetComplete 
                ? 'Your password has been successfully reset' 
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