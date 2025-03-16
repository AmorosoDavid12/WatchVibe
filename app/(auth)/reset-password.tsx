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
  
  // Check if this is a valid password reset request
  useEffect(() => {
    const checkResetRequest = async () => {
      try {
        console.log("ResetPassword: Checking for valid reset request");
        
        let resetToken = null;
        let resetEmail = null;
        
        // Check if this is a direct link to the reset-password page with token in URL
        // This handles the case where the redirect_to points directly to reset-password
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          
          // Check for token in URL query params
          const tokenFromUrl = 
            urlParams.get('token') || 
            params.token as string || 
            null;
            
          // Check for type=recovery in URL
          const typeFromUrl = 
            urlParams.get('type') === 'recovery' || 
            params.type === 'recovery' || 
            false;
            
          // If we have a token and it's a recovery, store it
          if (tokenFromUrl && typeFromUrl) {
            console.log("ResetPassword: Found token directly in URL");
            resetToken = tokenFromUrl;
            
            // Store in localStorage for future use
            localStorage.setItem('passwordResetToken', tokenFromUrl);
            localStorage.setItem('passwordResetTimestamp', Date.now().toString());
            
            // Also store any email if available
            const emailFromUrl = urlParams.get('email') || params.email as string;
            if (emailFromUrl) {
              resetEmail = emailFromUrl;
              localStorage.setItem('passwordResetEmail', emailFromUrl);
            }
          }
        }
        
        // Standard flow - check URL parameters and localStorage
        if (!resetToken && typeof window !== 'undefined') {
          // Check for passwordReset flag
          const passwordResetParam = params.passwordReset === 'true';
          const urlParams = new URLSearchParams(window.location.search);
          const urlPasswordReset = urlParams.get('passwordReset') === 'true';
          const isPasswordReset = passwordResetParam || urlPasswordReset;
          
          console.log("ResetPassword: passwordReset param:", isPasswordReset);
          
          // Check localStorage for stored token and email
          resetToken = resetToken || localStorage.getItem('passwordResetToken');
          resetEmail = resetEmail || localStorage.getItem('passwordResetEmail');
          const resetTimestamp = localStorage.getItem('passwordResetTimestamp');
          
          console.log("ResetPassword: Found token in localStorage:", !!resetToken);
        }
        
        // If we have a reset email, use it
        if (resetEmail) {
          console.log("ResetPassword: Using email:", resetEmail);
          setEmail(resetEmail);
        }
        
        // Check if reset token is still valid (less than 1 hour old)
        if (typeof window !== 'undefined') {
          const resetTimestamp = localStorage.getItem('passwordResetTimestamp');
          if (resetTimestamp) {
            const timestampAge = Date.now() - parseInt(resetTimestamp);
            const isTimestampValid = timestampAge < 3600000; // 1 hour in milliseconds
            console.log("ResetPassword: Token age (minutes):", Math.floor(timestampAge / 60000));
            
            if (!isTimestampValid) {
              setError("Your password reset link has expired. Please request a new one.");
              setIsCheckingReset(false);
              return;
            }
          }
        }
        
        // If we have a token, consider it valid
        if (resetToken) {
          console.log("ResetPassword: Found valid reset token");
          setIsValidResetRequest(true);
          setIsCheckingReset(false);
          return;
        }
        
        // No token found, invalid reset request
        console.log("ResetPassword: No valid reset token found");
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

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    
    try {
      // If email is empty, try to get it from localStorage
      const userEmail = email || localStorage.getItem('passwordResetEmail');
      
      if (!userEmail) {
        setError('Email address is required to reset your password');
        setLoading(false);
        return;
      }
      
      // Use the simplest approach to update the password
      console.log("ResetPassword: Updating password for email:", userEmail);
      
      // Get the token from localStorage
      const resetToken = localStorage.getItem('passwordResetToken');
      
      if (!resetToken) {
        setError('Reset token not found. Please request a new password reset link.');
        setLoading(false);
        return;
      }
      
      // Update user password directly with the Auth API
      console.log("ResetPassword: Sending reset password request");
      
      // First try to sign in using OTP (one-time password) with the token
      try {
        const { error } = await supabase.auth.updateUser({
          password: password
        });
        
        if (error) {
          // If updating fails with current session, try creating a new session
          if (error.message.includes('session')) {
            console.log("ResetPassword: No session, trying to sign in with OTP");
            
            // Try signing in with OTP
            const { error: otpError } = await supabase.auth.verifyOtp({
              email: userEmail,
              token: resetToken,
              type: 'recovery'
            });
            
            if (otpError) {
              throw otpError;
            }
            
            // After verifying OTP, try updating password again
            const { error: updateError } = await supabase.auth.updateUser({
              password: password
            });
            
            if (updateError) {
              throw updateError;
            }
          } else {
            throw error;
          }
        }
        
        // Password update successful
        console.log("ResetPassword: Password updated successfully");
        setSuccessMessage('Password has been updated successfully');
        setPasswordResetComplete(true);
        
        // Clean up localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('passwordResetToken');
          localStorage.removeItem('passwordResetData');
          localStorage.removeItem('passwordResetEmail');
          localStorage.removeItem('passwordResetTimestamp');
        }
        
        // Wait a moment before redirecting to login
        setTimeout(() => {
          // Sign out first to clear any session
          supabase.auth.signOut().then(() => {
            router.replace('/login');
          });
        }, 2000);
        
      } catch (error: any) {
        console.error("ResetPassword: Error updating password:", error);
        
        // Special handling for rate limit errors
        if (error.message && error.message.includes('security purposes')) {
          setError('Too many requests. Please wait a minute and try again.');
        } else if (error.message && error.message.includes('expired')) {
          setError('Your reset link has expired. Please request a new one.');
        } else {
          setError(error.message || 'Failed to update password');
        }
        
        setLoading(false);
      }
    } catch (error: any) {
      console.error("ResetPassword: Error in password update:", error);
      setError(error.message || 'An unexpected error occurred');
      setLoading(false);
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
                ? 'Your password has been updated successfully' 
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