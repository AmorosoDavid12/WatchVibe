import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock, ArrowLeft } from 'lucide-react-native';

/**
 * Reset Password Screen Component
 * 
 * IMPORTANT: This component handles the password reset functionality.
 * DO NOT modify the URL parameter handling and token processing logic
 * without thorough testing of the entire reset password flow.
 * 
 * The flow works as follows:
 * 1. User clicks reset link from email
 * 2. Link redirects to app with access tokens in URL hash or query params
 * 3. Component extracts tokens and establishes a Supabase session
 * 4. User sets a new password which is sent to Supabase to update
 * 
 * Any changes to this component can break the password reset functionality!
 */
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
  
  /**
   * CRITICAL AUTHENTICATION LOGIC
   * 
   * This effect handles the processing of password reset tokens either from URL hash fragments
   * or query parameters. It establishes a valid session with Supabase using the tokens.
   * 
   * WARNING: Do not modify this logic unless you fully understand Supabase's authentication flow.
   * Password reset will break if this token handling is changed incorrectly.
   */
  useEffect(() => {
    async function processAuthState() {
      try {
        // Only run in web environment
        if (typeof window === 'undefined') {
          setIsValidatingSession(false);
          return;
        }
        
        console.log("Processing auth state for password reset");
        console.log("URL:", window.location.href);
        
        // Check URL hash fragment first
        const hash = window.location.hash.substring(1);
        
        if (hash) {
          console.log("Found hash fragment in URL");
          
          // Parse hash parameters
          const hashParams: Record<string, string> = {};
          const hashParts = hash.split('&');
          
          for (const part of hashParts) {
            const [key, value] = part.split('=');
            if (key && value) {
              hashParams[key] = decodeURIComponent(value);
            }
          }
          
          console.log("Parsed hash params:", hashParams);
          
          // Extract tokens and type
          const accessToken = hashParams['access_token'];
          const refreshToken = hashParams['refresh_token'];
          const type = hashParams['type'];
          
          // Check for recovery type in hash - CRITICAL for password reset flow
          if (accessToken && (type === 'recovery' || hash.includes('type=recovery'))) {
            console.log("Found recovery tokens in hash, setting session");
            
            try {
              // Set the session with the tokens - this establishes auth with Supabase
              const { data, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              
              if (sessionError) {
                console.error("Error setting session from hash tokens:", sessionError);
                throw sessionError;
              }
              
              if (data?.session) {
                console.log("Successfully established session from hash tokens");
                setHasValidSession(true);
                setUserEmail(data.session.user.email || null);
                
                // Store in localStorage for redundancy
                localStorage.setItem('hasValidSession', 'true');
                localStorage.setItem('passwordResetEmail', data.session.user.email || '');
                localStorage.setItem('passwordResetTimestamp', Date.now().toString());
                localStorage.setItem('isRecoverySession', 'true');
                
                setIsValidatingSession(false);
                return;
              }
            } catch (tokenError) {
              console.error("Error processing token from hash:", tokenError);
            }
          }
        }
        
        // If hash processing didn't work, check for session directly
        const { data } = await supabase.auth.getSession();
        
        if (data?.session) {
          console.log("Found active session with user:", data.session.user.email);
          setHasValidSession(true);
          setUserEmail(data.session.user.email || null);
          setIsValidatingSession(false);
          return;
        }
        
        // No valid session, check localStorage for recovery info as a fallback
        if (typeof window !== 'undefined') {
          if (localStorage.getItem('hasValidSession') === 'true') {
            const email = localStorage.getItem('passwordResetEmail');
            const timestamp = localStorage.getItem('passwordResetTimestamp');
            
            // Verify session is not expired (1 hour validity)
            if (timestamp && (Date.now() - parseInt(timestamp)) < 3600000) {
              console.log("Found valid recovery info in localStorage for:", email);
              setHasValidSession(true);
              setUserEmail(email || null);
              setIsValidatingSession(false);
              return;
            } else {
              // Clear expired data
              localStorage.removeItem('hasValidSession');
              localStorage.removeItem('passwordResetEmail');
              localStorage.removeItem('passwordResetTimestamp');
              localStorage.removeItem('isRecoverySession');
            }
          }
        }
        
        console.log("No valid session found");
        setError("Your password reset link has expired or is invalid. Please request a new one.");
      } catch (err) {
        console.error("Error processing auth state:", err);
        setError("An error occurred while processing your reset link.");
      } finally {
        setIsValidatingSession(false);
      }
    }
    
    processAuthState();
  }, []);

  // Show loading state while validating session
  if (isValidatingSession) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#fff' }}>Verifying your password reset link...</Text>
      </View>
    );
  }
  
  // Show error state if no valid session was established
  if (!hasValidSession) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Surface style={styles.errorCard}>
          <Text style={styles.heading}>Reset Link Expired</Text>
          <Text style={styles.subheading}>Your reset link has expired or is invalid</Text>
          <Text style={styles.errorText}>{error || "Your password reset link has expired or is invalid. Please request a new one."}</Text>
          
          <TouchableOpacity onPress={() => router.push('/forgot-password')} style={styles.requestNewButton}>
            <Text style={styles.requestNewButtonText}>Request New Reset Link</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.backToLoginButton}>
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </Surface>
      </View>
    );
  }

  /**
   * Handle password reset submission
   * Validates the password, updates it with Supabase, and handles success/failure
   */
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
      // Update password using the existing Supabase session
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        throw error;
      }
      
      // Success!
      setSuccessMessage('Your password has been updated successfully!');
      
      // Clear localStorage data to remove recovery session markers
      localStorage.removeItem('hasValidSession');
      localStorage.removeItem('passwordResetEmail');
      localStorage.removeItem('passwordResetTimestamp');
      localStorage.removeItem('isRecoverySession'); // Clear recovery session flag
      
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

  // Main reset password form
  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer}>
        <Text style={styles.heading}>Reset Your Password</Text>
        {userEmail && (
          <Text style={styles.subheading}>Enter a new password for {userEmail}</Text>
        )}
        
        {successMessage ? (
          <Text style={styles.successText}>{successMessage}</Text>
        ) : (
          <>
            <TextInput
              label="New Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secureTextEntry}
              right={
                <TextInput.Icon 
                  icon={secureTextEntry ? 'eye-off' : 'eye'} 
                  onPress={() => setSecureTextEntry(!secureTextEntry)}
                />
              }
              style={styles.input}
              mode="outlined"
            />
            
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={secureConfirmTextEntry}
              right={
                <TextInput.Icon 
                  icon={secureConfirmTextEntry ? 'eye-off' : 'eye'} 
                  onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)}
                />
              }
              style={styles.input}
              mode="outlined"
            />
            
            {error && <HelperText type="error">{error}</HelperText>}
            
            <Button 
              mode="contained" 
              onPress={handleResetPassword}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Reset Password
            </Button>
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
  errorCard: {
    padding: 20,
    borderRadius: 10,
    elevation: 4,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.7,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
  requestNewButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#e21f70',
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  requestNewButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  backToLoginButton: {
    marginTop: 12,
    padding: 10,
  },
  backToLoginText: {
    color: '#e21f70',
  },
  successText: {
    color: '#4CAF50',
    marginBottom: 16,
    textAlign: 'center',
  },
}); 