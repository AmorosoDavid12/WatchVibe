import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock, ArrowLeft } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  const [isValidatingSession, setIsValidatingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Check for valid session on component mount
  useEffect(() => {
    async function checkSession() {
      try {
        // Get the current session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session check error:", error);
          setError("Your password reset link has expired. Please request a new one.");
          setIsValidatingSession(false);
          return;
        }
        
        if (data?.session) {
          console.log("Valid session found for password reset");
          setHasValidSession(true);
          setUserEmail(data.session.user.email);
        } else {
          console.log("No valid session found for password reset");
          setError("Your password reset link has expired. Please request a new one.");
        }
      } catch (err) {
        console.error("Error checking session:", err);
        setError("An error occurred while checking your reset request.");
      } finally {
        setIsValidatingSession(false);
      }
    }
    
    checkSession();
  }, []);

  async function handleResetPassword() {
    // Validate form fields
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

    // Reset state
    setError(null);
    setLoading(true);

    try {
      // Update password using the existing session
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        throw error;
      }
      
      // Success!
      setSuccessMessage('Your password has been updated successfully!');
      
      // Wait a moment before redirecting to login
      setTimeout(() => {
        // Sign out first to clear the session
        supabase.auth.signOut().then(() => {
          router.replace('/login');
        });
      }, 2000);
      
    } catch (error: any) {
      console.error("Password update error:", error);
      
      // Handle specific errors
      if (error.message?.includes('expired')) {
        setError('Your password reset link has expired. Please request a new one.');
      } else {
        setError(error.message || 'Failed to update password');
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle requesting a new password reset
  function handleRequestNewReset() {
    router.replace('/forgot-password');
  }

  // Show loading state
  if (isValidatingSession) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#fff' }}>Verifying your password reset...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          {hasValidSession ? 'Create New Password' : 'Reset Link Expired'}
        </Text>
        
        <Text variant="bodyLarge" style={styles.subtitle}>
          {hasValidSession 
            ? 'Enter your new password below' 
            : 'Your reset link has expired or is invalid'}
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
        
        {hasValidSession ? (
          <>
            {userEmail && (
              <Text style={styles.emailInfo}>
                Setting new password for: <Text style={styles.emailHighlight}>{userEmail}</Text>
              </Text>
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
            />
            
            <Button 
              mode="contained" 
              onPress={handleResetPassword}
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
            onPress={handleRequestNewReset}
            style={styles.button}
          >
            Request New Reset Link
          </Button>
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
  centered: {
    alignItems: 'center',
  },
  formContainer: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    textAlign: 'center',
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  backButtonText: {
    color: '#888',
    marginLeft: 8,
  },
  successMessage: {
    color: '#4CAF50',
    marginBottom: 16,
  },
  emailInfo: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#888',
  },
  emailHighlight: {
    fontWeight: 'bold',
    color: '#fff',
  },
}); 