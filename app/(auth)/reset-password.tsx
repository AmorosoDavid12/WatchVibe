import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  
  // Check for direct verification link first
  useEffect(() => {
    const checkForDirectVerification = async () => {
      try {
        // Check URL search params for a direct verification link
        if (typeof window !== 'undefined') {
          console.log('Checking for direct verification token in URL');
          const urlSearchParams = new URLSearchParams(window.location.search);
          const token = urlSearchParams.get('token');
          const type = urlSearchParams.get('type');
          
          if (token && type === 'recovery') {
            console.log('Found direct verification token');
            // We need to verify this token and create a session
            try {
              const { error } = await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'recovery',
              });
              
              if (error) {
                console.error('Error verifying OTP:', error);
                setError('Your reset link is invalid or has expired. Please request a new one.');
              } else {
                console.log('OTP verified successfully');
                setHasSession(true);
              }
            } catch (err) {
              console.error('Error processing verification token:', err);
              setError('There was a problem verifying your reset link.');
            } finally {
              setIsCheckingSession(false);
            }
            return;
          }
        }
        
        // Continue with normal session check
        checkSessionAndEvent();
      } catch (err) {
        console.error('Error in verification check:', err);
        setIsCheckingSession(false);
      }
    };
    
    checkForDirectVerification();
  }, []);

  // Check for password recovery event and session
  const checkSessionAndEvent = async () => {
    let isMounted = true;
    
    try {
      // Check if we have an active recovery session
      const { data: authData } = await supabase.auth.getSession();
      console.log('Reset password page - Session check:', authData?.session ? 'Has session' : 'No session');
      
      if (authData?.session) {
        // We have a session, proceed with password reset
        setHasSession(true);
        setIsCheckingSession(false);
      } else {
        // No session yet, try waiting a moment for session to be established
        // This helps when coming directly from the auth callback
        setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession();
          console.log('Retry session check:', retryData?.session ? 'Has session' : 'Still no session');
          
          if (retryData?.session) {
            setHasSession(true);
          } else {
            // No session, show error and provide option to request new link
            setError('No active session found. Please use a reset link from your email or request a new one.');
          }
          setIsCheckingSession(false);
        }, 1000);
      }
    } catch (err) {
      console.error('Error checking session:', err);
      setError('Error verifying your session. Please try again.');
      setIsCheckingSession(false);
    }
  };

  // Also set up a listener for the PASSWORD_RECOVERY event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: any, session: any) => {
        console.log('Auth event in reset password:', event);
        if (event === 'PASSWORD_RECOVERY') {
          // Password recovery event, mark session as valid
          console.log('PASSWORD_RECOVERY event detected with session:', !!session);
          setHasSession(true);
          setIsCheckingSession(false);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
      console.log('Attempting to update password');
      
      // Update the password directly
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        console.error('Error updating password:', error);
        throw error;
      }
      
      console.log('Password updated successfully');
      setSuccessMessage('Password has been updated successfully');
      setPasswordResetComplete(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        // Sign out first to clear the recovery session
        supabase.auth.signOut().then(() => {
          router.replace('/login');
        });
      }, 2000);
    } catch (error: any) {
      console.error('Password update error:', error);
      setError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  if (isCheckingSession) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Verifying your session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          {!hasSession ? 'Session Expired' : (passwordResetComplete ? 'Password Updated' : 'Create New Password')}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {!hasSession 
            ? 'Your session has expired or is invalid'
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
        
        {hasSession && !passwordResetComplete ? (
          <>
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
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
  },
  formContainer: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  successMessage: {
    color: '#4CAF50',
    marginBottom: 16,
  },
  redirectingText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#888',
  }
}); 