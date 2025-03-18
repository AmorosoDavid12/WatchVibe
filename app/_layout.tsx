import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import useAuth from '@/hooks/useAuth';
import { View, Text, ActivityIndicator } from 'react-native';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { useWatchedStore } from '@/lib/watchedStore';

// Create custom theme based on dark theme
const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#e21f70',
    secondary: '#FFD700',
    background: '#121212',
    surface: '#1a1a1a',
  },
};

export default function RootLayout() {
  useFrameworkReady();
  const { authInitialized } = useAuth();
  const [forceLoaded, setForceLoaded] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Get store actions
  const syncWatchlist = useWatchlistStore(state => state.syncWithSupabase);
  const syncWatched = useWatchedStore(state => state.syncWithSupabase);
  const watchlistLoading = useWatchlistStore(state => state.isLoading);
  const watchedLoading = useWatchedStore(state => state.isLoading);
  const watchlistInitialized = useWatchlistStore(state => state.isInitialized);
  const watchedInitialized = useWatchedStore(state => state.isInitialized);
  
  // Safety timeout to prevent getting stuck on the loading screen
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!authInitialized) {
        console.log('Root layout safety timeout triggered - forcing navigation');
        setForceLoaded(true);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [authInitialized]);

  // Force complete the loading after a reasonable timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!initialLoadComplete) {
        console.log('Safety timeout triggered - forcing data initialization complete');
        setDataInitialized(true);
        setInitialLoadComplete(true);
      }
    }, 5000); // 5 second safety timeout
    
    return () => clearTimeout(timeout);
  }, [initialLoadComplete]);

  // Initialize data stores once auth is initialized
  useEffect(() => {
    if (authInitialized || forceLoaded) {
      // Start parallel sync operations
      const initializeData = async () => {
        try {
          console.log('Initializing data stores...');
          // Run both syncs in parallel
          await Promise.all([
            syncWatchlist(),
            syncWatched()
          ]);
          console.log('Data stores initialized successfully');
        } catch (error) {
          console.error('Failed to initialize data stores:', error);
        } finally {
          setDataInitialized(true);
          setInitialLoadComplete(true);
        }
      };
      
      initializeData();
    }
  }, [authInitialized, forceLoaded]);
  
  // Only show the loading screen on initial load, not when switching pages
  // Once initialLoadComplete is true, we never show the loading screen again
  const isLoading = !initialLoadComplete && (
    (!authInitialized && !forceLoaded) || 
    (watchlistLoading && watchedLoading) ||
    (!watchlistInitialized && !watchedInitialized && !dataInitialized)
  );

  if (isLoading) {
    return (
      <PaperProvider theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
          <ActivityIndicator size="large" color="#e21f70" />
          <Text style={{ color: '#fff', marginTop: 20 }}>Loading...</Text>
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
      <Toast />
    </PaperProvider>
  );
}