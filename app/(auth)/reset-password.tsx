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
  const [hasSession, setHasSession] = useState(false);
  
  // Check if this is a valid password reset request
  useEffect(() => {
    const checkResetRequest = async () => {
      try {
        console.log("ResetPassword: Checking for valid reset request");
        
        // Check for verified=true in URL - this means the password-reset-handler successfully verified the token
        const verifiedParam = params.verified === 'true';
        if (verifiedParam) {
          console.log("ResetPassword: Verified flag found, user has a valid session");
          setHasSession(true);
          setIsValidResetRequest(true);
          setIsCheckingReset(false);
          
          // Get email from localStorage if available
          if (typeof window !== 'undefined') {
            const storedEmail = localStorage.getItem('passwordResetEmail');
            if (storedEmail) {
              setEmail(storedEmail);
            }
          }
          
          // Check session to confirm
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.log("ResetPassword: Session confirmed");
            if (sessionData.session.user?.email) {
              setEmail(sessionData.session.user.email);
            }
          } else {
            console.log("ResetPassword: No session found, but continuing with verified flag");
          }
          
          return;
        }
        
        // If not verified, try to check for session
        if (typeof window === 'undefined') {
          setIsCheckingReset(false);
          return;
        }
        
        // Check if we have a session already
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          console.log("ResetPassword: Session exists, can proceed with password reset");
          setHasSession(true);
          setIsValidResetRequest(true);
          
          // Set email from session
          if (sessionData.session.user?.email) {
            setEmail(sessionData.session.user.email);
          }
          
          setIsCheckingReset(false);
          return;
        }
        
        // Check if this came from our password-reset-handler with bypassAuth=true
        const bypassAuth = params.bypassAuth === 'true';
        if (bypassAuth) {
          console.log("ResetPassword: Auth bypass flag found, accepting reset request");
          
          // Get stored tokens - we'll try to use these to establish a session
          const tokenHash = localStorage.getItem('passwordResetTokenHash');
          const tokenType = localStorage.getItem('passwordResetType') || 'recovery';
          const directToken = localStorage.getItem('passwordResetToken');
          const storedEmail = localStorage.getItem('passwordResetEmail');
          
          // Set email if available
          if (storedEmail) {
            setEmail(storedEmail);
          }
          
          // Try to verify using tokenHash if available
          if (tokenHash) {
            try {
              console.log("ResetPassword: Trying to verify with token_hash");
              const { data, error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: tokenType as any
              });
              
              if (!error && data?.session) {
                console.log("ResetPassword: Successfully established session with token_hash");
                setHasSession(true);
                
                // Update email if available from session
                if (data.user?.email) {
                  setEmail(data.user.email);
                }
              } else {
                console.error("ResetPassword: Token hash verification failed:", error);
              }
            } catch (e) {
              console.error("ResetPassword: Error verifying token hash:", e);
            }
          }
          
          // If token hash didn't work, try direct token
          if (!hasSession && directToken) {
            try {
              console.log("ResetPassword: Trying to verify with direct token");
              const { data, error } = await supabase.auth.verifyOtp({
                token: directToken,
                type: 'recovery'
              });
              
              if (!error && data?.session) {
                console.log("ResetPassword: Successfully established session with direct token");
                setHasSession(true);
                
                // Update email if available from session
                if (data.user?.email) {
                  setEmail(data.user.email);
                }
              } else {
                console.error("ResetPassword: Direct token verification failed:", error);
              }
            } catch (e) {
              console.error("ResetPassword: Error verifying direct token:", e);
            }
          }
          
          // Always accept the reset request even if we couldn't establish session
          // We'll handle the password update differently based on hasSession
          setIsValidResetRequest(true);
          setIsCheckingReset(false);
          return;
        }
        
        // Check reset token in localStorage as fallback
        const resetToken = localStorage.getItem('passwordResetToken');
        const resetTimestamp = localStorage.getItem('passwordResetTimestamp');
        const storedEmail = localStorage.getItem('passwordResetEmail');
        
        // Set email if available
        if (storedEmail) {
          setEmail(storedEmail);
        }
        
        // Check if token is still valid (less than 1 hour old)
        if (resetTimestamp) {
          const timestampAge = Date.now() - parseInt(resetTimestamp);
          const isTimestampValid = timestampAge < 3600000; // 1 hour in milliseconds
          console.log("ResetPassword: Token age (minutes):", Math.floor(timestampAge / 60000));
          
          if (!isTimestampValid) {
            setError("Your password reset link has expired. Please request a new one.");
            setIsCheckingReset(false);
            return;
          }
        }
        
        // If we have a token or we've gone through our password-reset-handler, consider it valid
        if (resetToken) {
          console.log("ResetPassword: Found valid reset token");
          setIsValidResetRequest(true);
          setIsCheckingReset(false);
          return;
        }
        
        // No token found, invalid reset request
        console.log("ResetPassword: No valid reset session or token found");
        setError("No active reset request found. Please request a new password reset link.");
        setIsCheckingReset(false);
        
      } catch (err) {
        console.error("ResetPassword: Error checking reset request:", err);
        setError("Error checking your reset request. Please try again.");
        setIsCheckingReset(false);
      }
    };
    
    checkResetRequest();
  }, [params]);

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
      console.log("ResetPassword: Updating password, hasSession =", hasSession);
      
      if (hasSession) {
        // If we have a session, we can update the password directly
        console.log("ResetPassword: Using existing session to update password");
        const { error } = await supabase.auth.updateUser({
          password: password
        });
        
        if (error) {
          throw error;
        }
        
        // Password update successful
        handlePasswordUpdateSuccess();
      } else {
        // No session, use sign in with email/password first
        if (!email) {
          setError('Email address is required to reset your password');
          setLoading(false);
          return;
        }
        
        // Try using the token again to verify OTP
        const tokenHash = localStorage.getItem('passwordResetTokenHash');
        const tokenType = localStorage.getItem('passwordResetType') || 'recovery';
        const directToken = localStorage.getItem('passwordResetToken');
        
        // Try token_hash first if available
        if (tokenHash) {
          console.log("ResetPassword: Final attempt to verify with token_hash");
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: tokenType as any
            });
            
            if (!error && data?.session) {
              console.log("ResetPassword: Successfully established session with token_hash");
              
              // Now update the password
              const { error: updateError } = await supabase.auth.updateUser({
                password: password
              });
              
              if (updateError) {
                throw updateError;
              }
              
              // Password update successful
              handlePasswordUpdateSuccess();
              return;
            } else {
              console.error("ResetPassword: Final token_hash verification failed:", error);
            }
          } catch (e) {
            console.error("ResetPassword: Error in final token_hash verification:", e);
          }
        }
        
        // Try direct token if available
        if (directToken) {
          console.log("ResetPassword: Final attempt to verify with direct token");
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              token: directToken,
              type: 'recovery'
            });
            
            if (!error && data?.session) {
              console.log("ResetPassword: Successfully established session with direct token");
              
              // Now update the password
              const { error: updateError } = await supabase.auth.updateUser({
                password: password
              });
              
              if (updateError) {
                throw updateError;
              }
              
              // Password update successful
              handlePasswordUpdateSuccess();
              return;
            } else {
              console.error("ResetPassword: Final direct token verification failed:", error);
            }
          } catch (e) {
            console.error("ResetPassword: Error in final direct token verification:", e);
          }
        }
        
        // If all else fails, tell the user to request a new link
        setError("Unable to update password. Your reset link may have expired. Please request a new one.");
        setLoading(false);
      }
    } catch (error: any) {
      console.error("ResetPassword: Error in password update:", error);
      
      // Special handling for rate limit errors
      if (error.message && error.message.includes('security purposes')) {
        setError('Too many requests. Please wait a minute and try again.');
      } else if (error.message && (error.message.includes('expired') || error.message.includes('invalid'))) {
        setError('Your reset link has expired or is invalid. Please request a new one.');
      } else {
        setError(error.message || 'Failed to update password');
      }
      
      setLoading(false);
    }
  }
  
  function handlePasswordUpdateSuccess() {
    console.log("ResetPassword: Password updated successfully");
    setSuccessMessage('Password has been updated successfully');
    setPasswordResetComplete(true);
    
    // Clean up localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('passwordResetToken');
      localStorage.removeItem('passwordResetTokenHash');
      localStorage.removeItem('passwordResetType');
      localStorage.removeItem('passwordResetAccessToken');
      localStorage.removeItem('passwordResetRefreshToken');
      localStorage.removeItem('passwordResetEmail');
      localStorage.removeItem('passwordResetTimestamp');
      localStorage.removeItem('passwordResetSource');
    }
    
    // Wait a moment before redirecting to login
    setTimeout(() => {
      // Sign out first to clear any session
      supabase.auth.signOut().then(() => {
        router.replace('/login');
      });
    }, 2000);
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
    padding: 16,
    backgroundColor: '#121212',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 20,
    borderRadius: 8,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  backButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    marginLeft: 8,
    color: '#888',
  },
  successMessage: {
    color: 'green',
    marginBottom: 16,
  },
  redirectingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
}); 