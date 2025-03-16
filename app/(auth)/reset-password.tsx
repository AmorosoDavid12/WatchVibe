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
  
  // Check for reset token in URL parameters
  useEffect(() => {
    const checkForResetToken = async () => {
      try {
        if (typeof window !== 'undefined') {
          console.log('Checking for reset token in URL');
          
          const urlSearchParams = new URLSearchParams(window.location.search);
          const recoveryVerified = urlSearchParams.get('recovery_verified') === 'true';
          const token = urlSearchParams.get('token');
          const type = urlSearchParams.get('type');
          
          console.log('Reset-password params - recovery_verified:', recoveryVerified, 'token:', !!token, 'type:', type);
          
          // First check if we have a token directly in the URL
          if (token) {
            console.log('Found token in URL, storing for reset');
            setRecoveryToken(token);
            setHasResetToken(true);
            setIsCheckingToken(false);
            return;
          }
          
          // Then check if we're verified from callback
          if (recoveryVerified) {
            console.log('Recovery verified by callback, enabling password reset');
            // Check for session as the callback may have established one
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session) {
              console.log('Found session with recovery_verified');
            } else {
              console.log('No session with recovery_verified, may need token');
            }
            
            setHasResetToken(true);
            setIsCheckingToken(false);
            return;
          }
          
          // Try to extract token from hash if present
          const url = window.location.href;
          if (url.includes('#')) {
            const hashParams = Object.fromEntries(
              url.split('#')[1].split('&').map(pair => pair.split('='))
            );
            
            // Check for recovery type in hash
            if (hashParams.type === 'recovery' && hashParams.token) {
              console.log('Found recovery token in hash');
              setRecoveryToken(hashParams.token);
              setHasResetToken(true);
              setIsCheckingToken(false);
              return;
            }
          }
          
          // As a last resort, check for a session - this is for backwards compatibility
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.log('Found existing session, allowing password reset');
            setHasResetToken(true);
            setIsCheckingToken(false);
            return;
          }
          
          // No reset token or session found
          console.log('No reset token or session found');
          setError('No active reset token found. Please use a reset link from your email or request a new one.');
          setIsCheckingToken(false);
        }
      } catch (err) {
        console.error('Error checking for reset token:', err);
        setError('Error verifying your reset token. Please try again.');
        setIsCheckingToken(false);
      }
    };
    
    checkForResetToken();
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
      
      // Try to get the token again if we don't have it yet
      if (!recoveryToken && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        if (tokenFromUrl) {
          console.log('Found token in URL during password update');
          setRecoveryToken(tokenFromUrl);
        }
      }
      
      // For direct token-based password reset
      const tokenFromUrl = typeof window !== 'undefined' 
        ? new URLSearchParams(window.location.search).get('token')
        : null;
      
      const tokenToUse = recoveryToken || tokenFromUrl;
      
      if (tokenToUse) {
        console.log('Attempting to verify token and update password');
        
        // First verify the token
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenToUse,
          type: 'recovery',
        });
        
        if (verifyError) {
          console.error('Error verifying OTP:', verifyError);
          throw new Error('Your reset link is invalid or has expired. Please request a new one.');
        }
        
        console.log('Token verified successfully, updating password');
        
        // Now update the password
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        });
        
        if (updateError) {
          console.error('Error updating password:', updateError);
          throw updateError;
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
        
        return;
      }
      
      // Fallback to session-based update if we don't have a token
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        console.log('Using session to update password');
        const { error } = await supabase.auth.updateUser({
          password: password
        });
        
        if (error) {
          console.error('Error updating password with session:', error);
          throw error;
        }
        
        console.log('Password updated successfully with session');
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
        throw new Error('No valid session or recovery token found. Please request a new reset link.');
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