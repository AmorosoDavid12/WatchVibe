import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase, login, clearAuthTokens } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText, Divider } from 'react-native-paper';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import * as Linking from 'expo-linking';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  
  // Check if this is a password reset flow
  useEffect(() => {
    const checkForPasswordReset = async () => {
      try {
        if (typeof window !== 'undefined') {
          console.log('Checking for password reset flow');
          
          const urlSearchParams = new URLSearchParams(window.location.search);
          const source = urlSearchParams.get('source');
          const emailParam = urlSearchParams.get('email');
          
          console.log('Login params - source:', source, 'email:', emailParam);
          
          // If this is a password reset flow
          if (source === 'password_reset' && emailParam) {
            console.log('Detected password reset flow');
            setEmail(emailParam);
            
            // Check for existing session - the magic link should have created it
            const { data } = await supabase.auth.getSession();
            
            if (data?.session) {
              console.log('User is authenticated via magic link - enabling password reset');
              setIsPasswordReset(true);
              setSuccessMessage('Please set your new password below');
            } else {
              console.log('No session found for password reset');
              setError('Please click the link in your email to reset your password');
            }
          }
          
          setIsCheckingUser(false);
        }
      } catch (err) {
        console.error('Error checking for password reset:', err);
        setIsCheckingUser(false);
      }
    };
    
    checkForPasswordReset();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Clear all tokens before attempting login
      clearAuthTokens();
      
      const { error } = await login(email, password);
      
      if (error) {
        console.error('Login error:', error);
        setError(typeof error === 'object' && error !== null ? 
          (error as any).message || 'Failed to login' : 
          'Failed to login');
        setLoading(false);
      } else {
        console.log('Login successful, redirecting...');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Login exception:', error);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  async function handlePasswordUpdate() {
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
    setLoading(true);

    try {
      // We should already have a valid session from the magic link
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;
      
      setSuccessMessage('Password has been updated successfully');
      
      // Redirect after short delay
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'An error occurred updating your password');
      setLoading(false);
    }
  }

  if (isCheckingUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.text, { color: '#fff' }]}>Checking login status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          {isPasswordReset ? 'Set New Password' : 'Welcome Back'}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {isPasswordReset 
            ? 'Create a new password for your account' 
            : 'Sign in to your account'}
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
        
        {/* Email field - readonly in password reset mode */}
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          readOnly={isPasswordReset}
          disabled={isPasswordReset}
          left={<TextInput.Icon icon={() => <Mail size={20} color="#888" />} />}
        />
        
        {isPasswordReset ? (
          // Password reset UI
          <>
            <TextInput
              mode="outlined"
              label="New Password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry={secureTextEntry}
              left={<TextInput.Icon icon={() => <Lock size={20} color="#888" />} />}
              right={<TextInput.Icon icon={secureTextEntry ? "eye" : "eye-off"} onPress={() => setSecureTextEntry(!secureTextEntry)} />}
            />
            
            <TextInput
              mode="outlined"
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              secureTextEntry={secureConfirmTextEntry}
              left={<TextInput.Icon icon={() => <Lock size={20} color="#888" />} />}
              right={<TextInput.Icon icon={secureConfirmTextEntry ? "eye" : "eye-off"} onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)} />}
            />
            
            <Button 
              mode="contained" 
              onPress={handlePasswordUpdate}
              style={styles.button}
              loading={loading}
              disabled={loading}
            >
              Update Password
            </Button>
          </>
        ) : (
          // Regular login UI
          <>
            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry={secureTextEntry}
              left={<TextInput.Icon icon={() => <Lock size={20} color="#888" />} />}
              right={<TextInput.Icon icon={secureTextEntry ? "eye" : "eye-off"} onPress={() => setSecureTextEntry(!secureTextEntry)} />}
            />
            
            <TouchableOpacity 
              onPress={() => router.push('/forgot-password')}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
            
            <Button 
              mode="contained" 
              onPress={handleLogin}
              style={styles.button}
              loading={loading}
              disabled={loading}
            >
              Login
            </Button>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </>
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#6200ee',
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#888',
  },
  signupLink: {
    color: '#6200ee',
    marginLeft: 5,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
  },
  successMessage: {
    color: '#4CAF50',
    marginBottom: 16,
  },
});