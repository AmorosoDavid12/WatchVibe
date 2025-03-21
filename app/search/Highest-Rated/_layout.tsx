import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View, TouchableOpacity, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Search, CircleCheck, CircleUser, Bookmark } from 'lucide-react-native';

export default function HighestRatedLayout() {
  const router = useRouter();

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
          headerShadowVisible: false,
          headerShown: false
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false
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
            title: "Highest Rated Animes",
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
      
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => router.push('/')}
          >
            <Bookmark size={24} color="#888" />
            <Text style={styles.tabLabel}>Watchlist</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => router.push('/search')}
          >
            <Search size={24} color="#2196F3" />
            <Text style={[styles.tabLabel, styles.activeTab]}>Search</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => router.push('/watched')}
          >
            <CircleCheck size={24} color="#888" />
            <Text style={styles.tabLabel}>Watched</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => router.push('/profile')}
          >
            <CircleUser size={24} color="#888" />
            <Text style={styles.tabLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 69 : 49,
    backgroundColor: '#1a1a1a',
    borderTopColor: '#333',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  tabBar: {
    flexDirection: 'row',
    height: 49,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabLabel: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
  activeTab: {
    color: '#2196F3',
  }
}); 