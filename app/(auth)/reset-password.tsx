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
        
        // First check if there's a hash in the URL with tokens
        if (typeof window !== 'undefined' && window.location.hash) {
          console.log("ResetPassword: Found hash in URL");
          const hash = window.location.hash.substring(1); // Remove the # character
          const params = new URLSearchParams(hash);
          
          // Check if we have access and refresh tokens
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');
          
          if (accessToken && refreshToken && type === 'recovery') {
            console.log("ResetPassword: Found access and refresh tokens in hash for recovery");
            
            // Try to set the session with these tokens
            try {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (error) {
                console.error("ResetPassword: Error setting session from tokens:", error);
              } else if (data?.session) {
                console.log("ResetPassword: Successfully set session from tokens");
                
                // Get user email from session
                if (data.session.user?.email) {
                  setEmail(data.session.user.email);
                  localStorage.setItem('passwordResetEmail', data.session.user.email);
                }
                
                // Store these tokens in localStorage for later use
                localStorage.setItem('passwordResetAccessToken', accessToken);
                localStorage.setItem('passwordResetRefreshToken', refreshToken);
                localStorage.setItem('passwordResetTimestamp', Date.now().toString());
                
                setHasSession(true);
                setIsValidResetRequest(true);
                setIsCheckingReset(false);
                return;
              }
            } catch (sessionError) {
              console.error("ResetPassword: Exception setting session:", sessionError);
            }
          }
        }
        
        // If we couldn't set a session from URL hash, check localStorage and other methods
        let resetToken = null;
        let resetEmail = null;
        let hasAccessToken = false;
        
        if (typeof window !== 'undefined') {
          // Check for stored access and refresh tokens
          const accessToken = localStorage.getItem('passwordResetAccessToken');
          const refreshToken = localStorage.getItem('passwordResetRefreshToken');
          
          if (accessToken && refreshToken) {
            console.log("ResetPassword: Found stored access and refresh tokens");
            hasAccessToken = true;
            
            // Try to set the session with these tokens
            try {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (!error && data?.session) {
                console.log("ResetPassword: Successfully set session from stored tokens");
                
                // Get user email from session
                if (data.session.user?.email) {
                  setEmail(data.session.user.email);
                }
                
                setHasSession(true);
                setIsValidResetRequest(true);
                setIsCheckingReset(false);
                return;
              }
            } catch (sessionError) {
              console.error("ResetPassword: Exception setting session from stored tokens:", sessionError);
            }
          }
          
          // Check for token and email in localStorage
          resetToken = localStorage.getItem('passwordResetToken');
          resetEmail = localStorage.getItem('passwordResetEmail');
          
          // Check if we have a session already
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.log("ResetPassword: Found existing session");
            
            // Get user email from session
            if (sessionData.session.user?.email) {
              setEmail(sessionData.session.user.email);
            }
            
            setHasSession(true);
            setIsValidResetRequest(true);
            setIsCheckingReset(false);
            return;
          }
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
        
        // If we have either a token or access tokens, consider it valid
        if (resetToken || hasAccessToken) {
          console.log("ResetPassword: Found valid reset token or access tokens");
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
      // Use the simplest approach to update the password
      console.log("ResetPassword: Updating password");
      
      // If we have a session, we can update the password directly
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        console.error("ResetPassword: Error updating password:", error);
        // If it's a session error but we know we should have a session, try one more time
        if (error.message.includes('session') && hasSession) {
          console.log("ResetPassword: Session error but we should have a session, trying again");
          
          // Try to refresh the session from localStorage tokens
          const accessToken = localStorage.getItem('passwordResetAccessToken');
          const refreshToken = localStorage.getItem('passwordResetRefreshToken');
          
          if (accessToken && refreshToken) {
            console.log("ResetPassword: Setting session from stored tokens");
            
            // Try to set the session with these tokens
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (!sessionError) {
              console.log("ResetPassword: Successfully refreshed session, trying password update again");
              
              // Try updating the password again
              const { error: updateError } = await supabase.auth.updateUser({
                password: password
              });
              
              if (updateError) {
                throw updateError;
              } else {
                // Success!
                handlePasswordUpdateSuccess();
                return;
              }
            } else {
              throw sessionError;
            }
          } else {
            throw new Error("Session tokens not found");
          }
        } else {
          throw error;
        }
      } else {
        // Success!
        handlePasswordUpdateSuccess();
        return;
      }
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
    setSuccessMessage('Password has been updated successfully');
    setPasswordResetComplete(true);
    
    // Clean up localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('passwordResetToken');
      localStorage.removeItem('passwordResetAccessToken');
      localStorage.removeItem('passwordResetRefreshToken');
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