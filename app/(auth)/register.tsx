import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signUpWithEmail } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Mail, Lock, UserPlus } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);

  async function handleSignUp() {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { error } = await signUpWithEmail(email, password);
      if (error) throw error;
      // No need to redirect, useAuth hook will handle this
    } catch (error: any) {
      setError(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineLarge" style={styles.title}>Create Account</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>Join VibeWatch to start tracking</Text>

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
          autoCapitalize="none"
          keyboardType="email-address"
          left={<TextInput.Icon icon={() => <Mail size={20} color="#888" />} />}
          error={!!error && !email}
        />
        
        <TextInput
          mode="outlined"
          label="Password"
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
          label="Confirm Password"
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
          onPress={handleSignUp}
          style={styles.button}
          loading={loading}
          icon={() => <UserPlus size={20} color="#fff" />}
          disabled={loading}
        >
          Sign Up
        </Button>

        <Link href="/login" style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
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
  link: {
    alignSelf: 'center',
    marginTop: 24,
  },
  linkText: {
    color: '#888',
    fontSize: 14,
  },
});