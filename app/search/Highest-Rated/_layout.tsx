import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function HighestRatedLayout() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#121212',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#121212',
          },
        }}
      >
        <Stack.Screen
          name="index" 
          options={{ 
            title: "Highest Rated",
            headerBackTitle: "Back"
          }}
        />
        <Stack.Screen
          name="movies" 
          options={{ 
            title: "Highest Rated Movies",
            headerBackTitle: "Back"
          }}
        />
        <Stack.Screen
          name="tv" 
          options={{ 
            title: "Highest Rated TV Shows",
            headerBackTitle: "Back"
          }}
        />
        <Stack.Screen
          name="anime" 
          options={{ 
            title: "Highest Rated Anime",
            headerBackTitle: "Back"
          }}
        />
        <Stack.Screen
          name="documentaries" 
          options={{ 
            title: "Highest Rated Documentaries",
            headerBackTitle: "Back"
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