import React from 'react';
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function NewReleaseLayout() {
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
            title: 'New Releases',
          }}
        />
        <Stack.Screen
          name="movies"
          options={{
            title: 'New Movie Releases',
          }}
        />
        <Stack.Screen
          name="tv"
          options={{
            title: 'New TV Shows',
          }}
        />
        <Stack.Screen
          name="anime"
          options={{
            title: 'New Anime Releases',
          }}
        />
        <Stack.Screen
          name="documentaries"
          options={{
            title: 'New Documentaries',
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