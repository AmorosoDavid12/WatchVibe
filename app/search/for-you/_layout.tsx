import React from 'react';
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function ForYouLayout() {
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
            title: 'For You',
          }}
        />
        <Stack.Screen
          name="all"
          options={{
            title: 'All Recommendations',
          }}
        />
        <Stack.Screen
          name="movies"
          options={{
            title: 'Movie Recommendations',
          }}
        />
        <Stack.Screen
          name="tv"
          options={{
            title: 'TV Recommendations',
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