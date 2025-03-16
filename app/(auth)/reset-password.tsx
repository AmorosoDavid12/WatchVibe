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
    const checkForSession = async () => {
      try {
        if (typeof window !== 'undefined') {
          console.log('Checking for recovery session');
          
          const urlSearchParams = new URLSearchParams(window.location.search);
          const recoveryVerified = urlSearchParams.get('recovery_verified') === 'true';
          const errorParam = urlSearchParams.get('error');
          
          console.log('Reset-password params - recovery_verified:', recoveryVerified, 'error:', errorParam);
          
          if (errorParam === 'invalid_token') {
            console.error('Token validation failed in callback');
            setError('Your reset link is invalid or has expired. Please request a new one.');
            setIsCheckingToken(false);
            return;
          }
          
          // Check if we have a valid session from the password recovery flow
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('Found valid session for password reset');
            setHasResetToken(true);
            setIsCheckingToken(false);
            return;
          }
          
          // No valid session - try refreshing the session
          if (recoveryVerified) {
            console.log('Recovery verified but no session, trying to refresh');
            
            try {
              const { data, error } = await supabase.auth.refreshSession();
              
              if (error) {
                console.error('Session refresh failed:', error);
                throw error;
              }
              
              if (data?.session) {
                console.log('Session refreshed successfully');
                setHasResetToken(true);
                setIsCheckingToken(false);
                return;
              }
            } catch (refreshErr) {
              console.error('Error refreshing session:', refreshErr);
            }
          }
          
          // No session available
          console.log('No valid session found for password reset');
          setError('Your reset link has expired or is invalid. Please request a new one.');
          setIsCheckingToken(false);
        }
      } catch (err) {
        console.error('Error checking for session:', err);
        setError('Error verifying your session. Please try again.');
        setIsCheckingToken(false);
      }
    };
    
    checkForSession();
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
      
      // Since we've already logged in via the reset link, we should have a session
      console.log('Checking for session before updating password');
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session) {
        console.log('Active session found, updating password via session');
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
        console.error('No active session found for password reset');
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