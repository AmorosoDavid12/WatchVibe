import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useDataLoadingStore } from '@/lib/dataLoadingStore';
import { getCurrentSession } from '@/lib/supabase';

export default function LoadingScreen() {
  const router = useRouter();
  const [loadingStatus, setLoadingStatus] = useState('Preparing your data...');
  const [error, setError] = useState<string | null>(null);
  const [syncAttempts, setSyncAttempts] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Get sync function from the data loading store
  const { syncAllData, isDataSynced, isSyncInProgress, syncError } = useDataLoadingStore();
  
  // Check authentication status first
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getCurrentSession();
        setIsAuthenticated(Boolean(session));
      } catch (err) {
        console.error('Auth check error:', err);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Execute data sync when component mounts
  useEffect(() => {
    // Only proceed if authentication check has completed
    if (isAuthenticated === null) return;
    
    // If not authenticated, redirect to login
    if (isAuthenticated === false) {
      console.log('User not authenticated, redirecting to login...');
      router.replace('/login');
      return;
    }
    
    // Start data sync for authenticated users
    const initializeData = async () => {
      try {
        setLoadingStatus('Synchronizing your watchlist...');
        
        // Try to sync data
        const success = await syncAllData();
        
        if (success) {
          console.log('Data sync successful, redirecting to main app...');
          setLoadingStatus('Ready!');
          
          // Small delay for better UX
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 500);
        } else {
          // If sync failed, increment attempt counter
          setSyncAttempts(prev => prev + 1);
          
          // If we've tried too many times, show retry button
          if (syncAttempts >= 2) {
            setError('Having trouble connecting. Please try again.');
          } else {
            // Otherwise retry automatically
            setLoadingStatus('Retrying data sync...');
            setTimeout(() => {
              initializeData();
            }, 1500);
          }
        }
      } catch (err) {
        console.error('Data loading error:', err);
        setError('Something went wrong while loading your data.');
      }
    };
    
    // Only start sync process if not already synced and not in progress
    if (!isDataSynced && !isSyncInProgress) {
      initializeData();
    } else if (isDataSynced) {
      // Data already synced, go to main app
      router.replace('/(tabs)');
    }
  }, [syncAllData, isDataSynced, isSyncInProgress, isAuthenticated, syncAttempts]);
  
  // Effect to update status message based on sync state
  useEffect(() => {
    if (syncError) {
      setError(syncError);
    }
  }, [syncError]);
  
  // Handle manual retry
  const handleRetry = () => {
    setError(null);
    setSyncAttempts(0);
    // Force rerun of the effect
    setLoadingStatus('Retrying connection...');
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#e21f70" style={styles.spinner} />
        <Text style={styles.text}>{loadingStatus}</Text>
        
        {error && (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Button 
              mode="contained" 
              onPress={handleRetry} 
              style={styles.retryButton}
            >
              Retry
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  spinner: {
    marginBottom: 20,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  errorText: {
    color: '#ff6b6b',
    marginTop: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#e21f70',
  }
}); 