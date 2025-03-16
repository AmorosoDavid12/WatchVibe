import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { resetPassword } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Mail, ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleResetPassword() {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      setSuccessMessage('Password reset instructions have been sent to your email');
    } catch (error: any) {
      setError(error.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#888" />
        </TouchableOpacity>
      
        <Text variant="headlineMedium" style={styles.title}>Reset Password</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Enter your email and we'll send you instructions to reset your password
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
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
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
          Send Reset Instructions
        </Button>

        <Link href="/login" style={styles.link}>
          <Text style={styles.linkText}>Back to Login</Text>
        </Link>
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
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1,
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
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
  link: {
    alignSelf: 'center',
    marginTop: 24,
  },
  linkText: {
    color: '#888',
    fontSize: 14,
  },
  successMessage: {
    color: '#4CAF50',
    marginBottom: 16,
  }
}); 