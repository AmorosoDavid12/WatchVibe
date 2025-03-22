import React from 'react';
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function TrendingNowLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#121212',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Trending Now',
          }}
        />
        <Stack.Screen
          name="movies"
          options={{
            title: 'Trending Movies',
          }}
        />
        <Stack.Screen
          name="tv"
          options={{
            title: 'Trending TV Shows',
          }}
        />
        <Stack.Screen
          name="anime"
          options={{
            title: 'Trending Anime',
          }}
        />
        <Stack.Screen
          name="documentaries"
          options={{
            title: 'Trending Documentaries',
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
}); 