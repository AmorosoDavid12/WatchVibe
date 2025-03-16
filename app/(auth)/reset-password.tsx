import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check for password recovery event and session
  useEffect(() => {
    const checkSessionAndEvent = async () => {
      try {
        // Check if we have an active recovery session
        const { data: authData } = await supabase.auth.getSession();
        
        if (authData?.session) {
          // We have a session, proceed with password reset
          setHasSession(true);
          
          // Also set up a listener for the PASSWORD_RECOVERY event
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event: any, session: any) => {
              if (event === 'PASSWORD_RECOVERY') {
                // Password recovery event, mark session as valid
                setHasSession(true);
              }
            }
          );
          
          return () => {
            subscription.unsubscribe();
          };
        } else {
          // No session, show error
          setError('No active session found. Please use a reset link from your email.');
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setError('Error verifying your session. Please try again.');
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSessionAndEvent();
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
      // Update the password directly
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      setSuccessMessage('Password has been updated successfully');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        // Sign out first to clear the recovery session
        supabase.auth.signOut().then(() => {
          router.replace('/login');
        });
      }, 2000);
    } catch (error: any) {
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
          {!hasSession ? 'Session Expired' : 'Create New Password'}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {!hasSession 
            ? 'Your session has expired or is invalid'
            : 'Enter your new password below'}
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
        
        {hasSession ? (
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
        ) : (
          <Button 
            mode="contained" 
            onPress={handleRequestNewLink}
            style={styles.button}
          >
            Request New Link
          </Button>
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
  }
}); 