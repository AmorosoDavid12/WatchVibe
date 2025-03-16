import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { updatePassword, supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const segments = useSegments();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [hasProcessedHash, setHasProcessedHash] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);

  // Process the hash in the URL to get the access token
  useEffect(() => {
    if (hasProcessedHash) return;

    const processHashParams = async () => {
      try {
        if (Platform.OS === 'web') {
          // Get hash from URL
          const hash = window.location.hash;
          
          // Check for error in hash (like expired token)
          if (hash && hash.includes('error=access_denied') && hash.includes('otp_expired')) {
            setTokenExpired(true);
            setError('Your password reset link has expired. Please request a new one.');
            return;
          }
          
          // Check for token in hash
          if (hash && hash.includes('access_token')) {
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const type = hashParams.get('type');
            
            if (accessToken && type === 'recovery') {
              // Process the session with Supabase
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              
              if (error) {
                console.error('Error setting session:', error.message);
                setError('Authentication session error. Please request a new password reset link.');
              } else if (data?.session) {
                setHasProcessedHash(true);
                // Session set successfully
              } else {
                setError('Failed to establish an authentication session. Please request a new link.');
              }
            } else {
              setError('Invalid reset token. Please request a new password reset link.');
            }
          } else {
            setError('No reset token found. Please use the link from your email.');
          }
        }
      } catch (err) {
        console.error('Error processing reset token:', err);
        setError('Failed to process reset token. Please try again.');
      }
    };

    processHashParams();
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
      // First verify we have a valid session
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setError('No active session found. Please use a new reset link from your email.');
        setLoading(false);
        return;
      }
      
      // Supabase updateUser will use the current session
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

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          {tokenExpired ? 'Link Expired' : 'Create New Password'}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {tokenExpired 
            ? 'Your password reset link has expired'
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
        
        {!tokenExpired ? (
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
              disabled={tokenExpired}
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
              disabled={tokenExpired}
            />
            
            <Button 
              mode="contained" 
              onPress={handleUpdatePassword}
              style={styles.button}
              loading={loading}
              disabled={loading || !!error || tokenExpired}
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