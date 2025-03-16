import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signInWithEmail, signInWithGoogle } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, ActivityIndicator, HelperText, Divider } from 'react-native-paper';
import { Mail, Lock, LogIn } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  async function handleSignIn() {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { error } = await signInWithEmail(email, password);
      if (error) throw error;
      // No need to redirect, useAuth hook will handle this
    } catch (error: any) {
      setError(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Auth will be handled by redirect flow
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineLarge" style={styles.title}>VibeWatch</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>Track your entertainment journey</Text>

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

        <Link href="/forgot-password" style={styles.forgotPasswordLink}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </Link>
        
        <Button 
          mode="contained" 
          onPress={handleSignIn}
          style={styles.button}
          loading={loading}
          icon={() => <LogIn size={20} color="#fff" />}
          disabled={loading || googleLoading}
        >
          Sign In
        </Button>

        <View style={styles.dividerContainer}>
          <Divider style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <Divider style={styles.divider} />
        </View>

        <Button 
          mode="outlined" 
          onPress={handleGoogleSignIn}
          style={styles.googleButton}
          loading={googleLoading}
          icon="google"
          disabled={loading || googleLoading}
        >
          Sign in with Google
        </Button>

        <Link href="/register" style={styles.link}>
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#e21f70',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    backgroundColor: '#444',
  },
  dividerText: {
    color: '#888',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    marginBottom: 16,
    borderColor: '#444',
  },
  link: {
    alignSelf: 'center',
    marginTop: 8,
  },
  linkText: {
    color: '#888',
    fontSize: 14,
  },
});