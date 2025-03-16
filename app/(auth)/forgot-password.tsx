import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { resetPassword } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Mail, ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleResetPassword() {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      
      setEmailSent(true);
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          Reset Password
        </Text>

        {!emailSent ? (
          <>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Enter the email address associated with your account
            </Text>

            {error && (
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            )}

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
              left={<TextInput.Icon icon={() => <Mail size={20} color="#888" />} />}
              error={!!error && !email}
            />

            <Button 
              mode="contained" 
              onPress={handleResetPassword}
              style={styles.button}
              loading={loading}
              disabled={loading}
            >
              Send Magic Link
            </Button>
          </>
        ) : (
          <>
            <Text variant="bodyLarge" style={styles.successMessage}>
              We've sent a magic link to <Text style={styles.emailText}>{email}</Text>.
            </Text>
            <Text style={styles.instructions}>
              Please check your email and click on the link to set a new password.
            </Text>
          </>
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
    marginBottom: 16,
  },
  subtitle: {
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 24,
    backgroundColor: '#2a2a2a',
  },
  button: {
    marginBottom: 16,
    paddingVertical: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  backButtonText: {
    color: '#888',
    marginLeft: 8,
  },
  successMessage: {
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 16,
  },
  emailText: {
    fontWeight: 'bold',
  },
  instructions: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  }
}); 