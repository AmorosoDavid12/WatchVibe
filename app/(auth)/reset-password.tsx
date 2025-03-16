import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock, ArrowLeft } from 'lucide-react-native';

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
  const [isValidatingSession, setIsValidatingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Handle URL hash and establish session when component mounts
  useEffect(() => {
    async function processAuthState() {
      try {
        // Only run in web environment
        if (typeof window === 'undefined') {
          setIsValidatingSession(false);
          return;
        }
        
        console.log("Processing auth state for password reset");
        
        // Check URL search params first (new approach)
        const urlParams = new URLSearchParams(window.location.search);
        const isPasswordReset = urlParams.get('type') === 'recovery';
        
        if (isPasswordReset) {
          console.log("Detected recovery in URL params");
          
          // We need to wait for Supabase to process the token and establish a session
          const { data } = await supabase.auth.getSession();
          
          if (data?.session) {
            console.log("Valid session established from recovery token");
            setHasValidSession(true);
            setUserEmail(data.session.user.email || null);
            setIsValidatingSession(false);
            return;
          }
        }
        
        // Check localStorage (set by callback.tsx)
        if (localStorage.getItem('hasValidSession') === 'true') {
          const email = localStorage.getItem('passwordResetEmail');
          const timestamp = localStorage.getItem('passwordResetTimestamp');
          
          // Check if the reset link is still valid (1 hour)
          if (timestamp && (Date.now() - parseInt(timestamp)) < 3600000) {
            console.log("Found valid session data in localStorage", email);
            setHasValidSession(true);
            setUserEmail(email || null);
            setIsValidatingSession(false);
            return;
          } else {
            // Clear expired data
            localStorage.removeItem('hasValidSession');
            localStorage.removeItem('passwordResetEmail');
            localStorage.removeItem('passwordResetTimestamp');
          }
        }
        
        // Get hash fragment (without the # character)
        const hash = window.location.hash.substring(1);
        
        if (hash) {
          // Parse hash params
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');
          
          console.log("Hash params type:", type);
          
          // If we have recovery tokens, set the session
          if (accessToken && type === 'recovery') {
            console.log("Found recovery tokens, setting session");
            
            // Set the session with the tokens
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (sessionError) {
              console.error("Error setting session:", sessionError);
              throw sessionError;
            }
            
            if (data?.session) {
              console.log("Successfully established session from hash");
              setHasValidSession(true);
              setUserEmail(data.session.user.email || null);
              
              // Store in localStorage for redundancy
              localStorage.setItem('hasValidSession', 'true');
              localStorage.setItem('passwordResetEmail', data.session.user.email || '');
              localStorage.setItem('passwordResetTimestamp', Date.now().toString());
              
              // Clean the URL by removing the hash
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              
              setIsValidatingSession(false);
              return;
            }
          }
        }
        
        // Last resort: check if we have a valid session already
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log("Found existing valid session");
          setHasValidSession(true);
          setUserEmail(data.session.user.email || null);
        } else {
          console.log("No valid session found through any method");
          setError("Your password reset link has expired or is invalid. Please request a new one.");
        }
      } catch (err) {
        console.error("Error processing auth state:", err);
        setError("An error occurred while processing your reset link.");
      } finally {
        setIsValidatingSession(false);
      }
    }
    
    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth state changed: ${event}`);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event detected');
        
        if (session?.user?.email) {
          setHasValidSession(true);
          setUserEmail(session.user.email || null);
          setIsValidatingSession(false);
          
          // Store in localStorage
          localStorage.setItem('hasValidSession', 'true');
          localStorage.setItem('passwordResetEmail', session.user.email);
          localStorage.setItem('passwordResetTimestamp', Date.now().toString());
        }
      }
    });
    
    processAuthState();
    
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
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
      
      // Clear localStorage data
      localStorage.removeItem('hasValidSession');
      localStorage.removeItem('passwordResetEmail');
      localStorage.removeItem('passwordResetTimestamp');
      
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
        <Text style={{ color: '#fff' }}>Verifying your password reset link...</Text>
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