import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import useAuth from '@/hooks/useAuth';
import { View, Text, ActivityIndicator } from 'react-native';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';

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

  if (!authInitialized && !forceLoaded) {
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