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

  // Process the hash in the URL to get the access token
  useEffect(() => {
    if (hasProcessedHash) return;

    const processHashParams = async () => {
      try {
        if (Platform.OS === 'web') {
          // Get hash from URL (e.g., #access_token=xyz&type=recovery)
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            // Process the hash - Supabase client has built-in handling
            const { error } = await supabase.auth.getSession();
            if (error) {
              console.error('Error setting session:', error.message);
              setError('Authentication session error. Please try requesting a new password reset link.');
            } else {
              setHasProcessedHash(true);
            }
          } else {
            setError('Invalid or missing reset token. Please request a new password reset link.');
          }
        }
      } catch (err) {
        console.error('Error processing reset token:', err);
        setError('Failed to process reset token. Please try again.');
      }
    };

    processHashParams();
  }, []);

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
      // Supabase updateUser will use the current session from the hash
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      setSuccessMessage('Password has been updated successfully');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.replace('/login');
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
        <Text variant="headlineMedium" style={styles.title}>Create New Password</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Enter your new password below
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
          disabled={loading || !!error}
        >
          Update Password
        </Button>
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