import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text, TextInput, Button, Surface, HelperText } from 'react-native-paper';
import { Lock, ArrowLeft } from 'lucide-react-native';

export default function ResetPasswordScreen() {
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
  const [isValidResetRequest, setIsValidResetRequest] = useState(false);
  const [isCheckingReset, setIsCheckingReset] = useState(true);
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  
  // Check if this is a valid password reset request
  useEffect(() => {
    const checkResetRequest = async () => {
      try {
        console.log("ResetPassword: Checking for valid reset request");
        
        if (typeof window !== 'undefined') {
          // Check URL parameters first
          const urlParams = new URLSearchParams(window.location.search);
          const isPasswordReset = urlParams.get('passwordReset') === 'true';
          console.log("ResetPassword: passwordReset param:", isPasswordReset);
          
          // Check localStorage for token and other data
          const resetToken = localStorage.getItem('passwordResetToken');
          const resetData = localStorage.getItem('passwordResetData');
          const resetEmail = localStorage.getItem('passwordResetEmail');
          const resetTimestamp = localStorage.getItem('passwordResetTimestamp');
          
          console.log("ResetPassword: Found token in localStorage:", !!resetToken);
          console.log("ResetPassword: Found reset data:", !!resetData);
          
          // If we have a reset email, use it
          if (resetEmail) {
            console.log("ResetPassword: Using stored email:", resetEmail);
            setEmail(resetEmail);
          }
          
          // Check if reset token is still valid (less than 1 hour old)
          if (resetTimestamp) {
            const timestampAge = Date.now() - parseInt(resetTimestamp);
            const isTimestampValid = timestampAge < 3600000; // 1 hour in milliseconds
            console.log("ResetPassword: Token age (minutes):", Math.floor(timestampAge / 60000));
            console.log("ResetPassword: Token still valid:", isTimestampValid);
            
            if (!isTimestampValid) {
              setError("Your password reset link has expired. Please request a new one.");
              setIsCheckingReset(false);
              return;
            }
          }
          
          // First check if we have a session from the magic link
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log("ResetPassword: Valid session found");
            setIsValidResetRequest(true);
            setIsCheckingReset(false);
            return;
          }
          
          // If no session but we have a token stored, consider it valid
          // User will need to verify the token during password update
          if (isPasswordReset && resetToken) {
            console.log("ResetPassword: No session but found reset token");
            setIsValidResetRequest(true);
            setIsCheckingReset(false);
            return;
          }
          
          // Nothing found, invalid reset request
          console.log("ResetPassword: No valid reset session or token found");
          setError("No active reset request found. Please request a new password reset link.");
          setIsCheckingReset(false);
        }
      } catch (err) {
        console.error("ResetPassword: Error checking reset request:", err);
        setError("Error checking your reset request. Please try again.");
        setIsCheckingReset(false);
      }
    };
    
    checkResetRequest();
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
      console.log("ResetPassword: Attempting to update password");
      
      // Check if we have a session already
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session) {
        console.log("ResetPassword: Using existing session to update password");
        // We have a session already, update password directly
        const { error } = await supabase.auth.updateUser({
          password: password
        });
        
        if (error) throw error;
        
        console.log("ResetPassword: Password updated successfully");
        setSuccessMessage('Password has been updated successfully');
        setPasswordResetComplete(true);
        
        // Clean up localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('passwordResetToken');
          localStorage.removeItem('passwordResetData');
          localStorage.removeItem('passwordResetEmail');
          localStorage.removeItem('passwordResetTimestamp');
        }
        
        // Sign out and redirect to login after 2 seconds
        setTimeout(() => {
          supabase.auth.signOut().then(() => {
            router.replace('/login');
          });
        }, 2000);
      } else {
        // No session, try using stored token
        console.log("ResetPassword: No session, trying with stored token");
        
        if (typeof window !== 'undefined') {
          const resetToken = localStorage.getItem('passwordResetToken');
          
          if (resetToken) {
            console.log("ResetPassword: Found token in localStorage, using for reset");
            
            try {
              // Make a direct API call to the Supabase Auth API
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
              
              if (!supabaseUrl || !supabaseKey) {
                throw new Error("Missing Supabase configuration");
              }
              
              // This approach depends on having a valid token
              const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${resetToken}`,
                  'apikey': supabaseKey
                },
                body: JSON.stringify({
                  password: password
                })
              });
              
              const result = await response.json();
              
              if (!response.ok) {
                console.error("ResetPassword: API error:", result);
                throw new Error(result.error_description || result.msg || "Error updating password");
              }
              
              console.log("ResetPassword: Password updated successfully via API");
              setSuccessMessage('Password has been updated successfully');
              setPasswordResetComplete(true);
              
              // Clean up localStorage
              localStorage.removeItem('passwordResetToken');
              localStorage.removeItem('passwordResetData');
              localStorage.removeItem('passwordResetEmail');
              localStorage.removeItem('passwordResetTimestamp');
              
              // Redirect to login after 2 seconds
              setTimeout(() => {
                router.replace('/login');
              }, 2000);
            } catch (apiError: any) {
              console.error("ResetPassword: Direct API error:", apiError);
              setError(apiError.message || 'Error updating password. Please try again.');
              setLoading(false);
            }
          } else {
            setError('No valid reset token found. Please request a new reset link.');
            setLoading(false);
          }
        } else {
          setError('Unable to complete password reset. Please try again.');
          setLoading(false);
        }
      }
    } catch (error: any) {
      console.error("ResetPassword: Error updating password:", error);
      setError(error.message || 'Failed to update password');
      setLoading(false);
    }
  }

  if (isCheckingReset) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: '#fff' }}>Verifying your reset request...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.formContainer} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          {!isValidResetRequest ? 'Reset Link Expired' : (passwordResetComplete ? 'Password Updated' : 'Create New Password')}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {!isValidResetRequest 
            ? 'Your reset link has expired or is invalid'
            : (passwordResetComplete 
                ? 'Your password has been updated successfully' 
                : 'Enter your new password below')}
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
        
        {isValidResetRequest && !passwordResetComplete ? (
          <>
            {/* Only show the email field if it's not pre-filled */}
            {!email && (
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
                error={!!error && !email}
              />
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
              disabled={loading}
            >
              Update Password
            </Button>
          </>
        ) : !passwordResetComplete && (
          <Button 
            mode="contained" 
            onPress={handleRequestNewLink}
            style={styles.button}
          >
            Request New Link
          </Button>
        )}

        {passwordResetComplete && (
          <Text style={styles.redirectingText}>
            Redirecting to login...
          </Text>
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
  },
  redirectingText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
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
}); 