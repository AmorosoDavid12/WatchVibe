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
  const [hasResetToken, setHasResetToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  
  // Check for reset token in localStorage
  useEffect(() => {
    const checkForRecoveryToken = async () => {
      try {
        if (typeof window !== 'undefined') {
          console.log('Checking for recovery token');
          
          const urlSearchParams = new URLSearchParams(window.location.search);
          const source = urlSearchParams.get('source');
          const errorParam = urlSearchParams.get('error');
          
          console.log('Reset-password params - source:', source, 'error:', errorParam);
          
          // Check for specific error conditions
          if (errorParam) {
            let errorMessage = 'Your reset link has expired or is invalid. Please request a new one.';
            
            if (errorParam === 'missing_token') {
              errorMessage = 'No recovery token was found in your reset link. Please request a new one.';
            } else if (errorParam === 'process_error') {
              errorMessage = 'There was an error processing your reset link. Please try again.';
            }
            
            console.error('Error detected in URL params:', errorParam);
            setError(errorMessage);
            setIsCheckingToken(false);
            return;
          }
          
          // Check for token in localStorage if we came from direct recovery
          if (source === 'direct_recovery') {
            const storedToken = localStorage.getItem('recovery_token');
            
            if (storedToken) {
              console.log('Found recovery token in localStorage');
              setRecoveryToken(storedToken);
              setHasResetToken(true);
              setIsCheckingToken(false);
              return;
            }
          }
          
          // If no token in localStorage, fall back to checking for a session
          // This is for backward compatibility
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('Found valid session for password reset');
            setHasResetToken(true);
            setIsCheckingToken(false);
            return;
          }
          
          // No token or session found
          console.log('No recovery token or session found');
          setError('Your reset link has expired or is invalid. Please request a new one.');
          setIsCheckingToken(false);
        }
      } catch (err) {
        console.error('Error checking for recovery token:', err);
        setError('Error verifying your recovery link. Please try again.');
        setIsCheckingToken(false);
      }
    };
    
    checkForRecoveryToken();
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
      
      // Try using the recovery token if available
      if (recoveryToken) {
        console.log('Using recovery token to reset password');
        
        try {
          // Make a direct API call to Supabase Auth API to verify the token
          // and update the password in one step
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gihofdmqjwgkotwxdxms.supabase.co';
          const apiUrl = `${supabaseUrl}/auth/v1/verify`;
          
          console.log('Making direct API call to verify token and update password');
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              token: recoveryToken,
              type: 'recovery',
              password: password
            })
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            console.error('API error:', result.error, result.error_description);
            throw new Error(result.error_description || 'Error updating password');
          }
          
          console.log('Password updated successfully via direct API');
          setSuccessMessage('Password has been updated successfully');
          setPasswordResetComplete(true);
          
          // Clean up the token from localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('recovery_token');
          }
          
          // Redirect to login after 2 seconds
          setTimeout(() => {
            router.replace('/login');
          }, 2000);
          
          return;
        } catch (apiErr: any) {
          console.error('Error with direct API call:', apiErr);
          
          // Fall back to normal Supabase client approach
          try {
            console.log('Falling back to Supabase client API');
            const { error } = await supabase.auth.updateUser({ 
              password
            });
            
            if (error) {
              console.error('Error updating password with client API:', error);
              throw error;
            }
            
            console.log('Password updated successfully with client API');
            setSuccessMessage('Password has been updated successfully');
            setPasswordResetComplete(true);
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
              supabase.auth.signOut().then(() => {
                router.replace('/login');
              });
            }, 2000);
            
            return;
          } catch (clientErr) {
            console.error('Client API fallback also failed:', clientErr);
            throw apiErr; // Throw original error
          }
        }
      }
      
      // Fall back to using the session if available
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session) {
        console.log('Using session to update password');
        const { error } = await supabase.auth.updateUser({ password });
        
        if (error) {
          console.error('Error updating password:', error);
          throw error;
        }
        
        console.log('Password updated successfully');
        setSuccessMessage('Password has been updated successfully');
        setPasswordResetComplete(true);
        
        // Sign out and redirect to login after 2 seconds
        setTimeout(() => {
          // Sign out to ensure clean state
          supabase.auth.signOut().then(() => {
            router.replace('/login');
          });
        }, 2000);
      } else {
        console.error('No recovery token or session found for password update');
        throw new Error('Your reset link has expired. Please request a new one.');
      }
    } catch (error: any) {
      console.error('Password update error:', error);
      setError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  if (isCheckingToken) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Verifying your reset token...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          {!hasResetToken ? 'Reset Link Expired' : (passwordResetComplete ? 'Password Updated' : 'Create New Password')}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {!hasResetToken 
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
        
        {hasResetToken && !passwordResetComplete ? (
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