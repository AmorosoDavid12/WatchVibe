import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function SearchLayout() {
  return (
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
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index" 
        options={{ 
          title: "Search",
          headerBackTitle: "Back"
        }}
      />
      
      {/* For You routes */}
      <Stack.Screen
        name="for-you/index" 
        options={{ 
          title: "Recommended For You",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="for-you/all" 
        options={{ 
          title: "All Recommendations",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="for-you/movies" 
        options={{ 
          title: "Movie Recommendations",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="for-you/tv" 
        options={{ 
          title: "TV Recommendations",
          headerBackTitle: "Back"
        }}
      />
      
      {/* Trending Now routes */}
      <Stack.Screen
        name="trending-now/index" 
        options={{ 
          title: "Trending Now",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="trending-now/movies" 
        options={{ 
          title: "Trending Movies",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="trending-now/tv" 
        options={{ 
          title: "Trending TV Shows",
          headerBackTitle: "Back"
        }}
      />
      
      {/* New Release routes */}
      <Stack.Screen
        name="new-release/index" 
        options={{ 
          title: "New Releases",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="new-release/movies" 
        options={{ 
          title: "New Movie Releases",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="new-release/tv" 
        options={{ 
          title: "New TV Shows",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="new-release/anime" 
        options={{ 
          title: "New Anime Releases",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="new-release/documentaries" 
        options={{ 
          title: "New Documentaries",
          headerBackTitle: "Back"
        }}
      />
      
      {/* Highest-Rated routes */}
      <Stack.Screen
        name="Highest-Rated/movies" 
        options={{ 
          title: "Highest Rated Movies",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="Highest-Rated/tv" 
        options={{ 
          title: "Highest Rated TV Shows",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="Highest-Rated/anime" 
        options={{ 
          title: "Highest Rated Anime",
          headerBackTitle: "Back"
        }}
      />
      <Stack.Screen
        name="Highest-Rated/documentaries" 
        options={{ 
          title: "Highest Rated Documentaries",
          headerBackTitle: "Back"
        }}
      />
    </Stack>
  );
} 