import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, getCurrentSession } from '@/lib/supabase';
import { Settings, LogOut, Star } from 'lucide-react-native';
import { Text, Button, Card, Avatar, ActivityIndicator, Divider, Surface } from 'react-native-paper';
import { logout } from '@/lib/supabase';

interface WatchedItem {
  rating?: number;
  duration?: number;
}

interface Profile {
  id: string;
  username?: string;
  avatar_url?: string;
  email?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalWatched: 0,
    avgRating: 0,
    watchTime: 0,
  });

  useEffect(() => {
    // Create a main loading function with timeout
    const loadProfileData = async () => {
      // Set a timeout for the entire loading process
      const timeout = setTimeout(() => {
        if (loading) {
          console.log('Profile data loading timed out');
          setLoading(false);
          setError('Loading timed out. Please try again.');
        }
      }, 5000); // 5 seconds timeout

      try {
        // Run both fetch operations in parallel
        await Promise.all([
          fetchProfile(),
          fetchStats()
        ]);
      } catch (error) {
        console.error('Error loading profile data:', error);
        setError('Failed to load profile data');
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

  async function fetchProfile() {
    try {
      console.log('Fetching user profile data');
      // Use our enhanced getCurrentSession instead of direct Supabase call
      const session = await getCurrentSession();
      
      if (session?.user) {
        const user = session.user;
        // Get user data directly from auth session
        setProfile({
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
          avatar_url: user.user_metadata?.avatar_url
        });
        console.log('Profile data loaded successfully');
      } else {
        throw new Error('No authenticated user found');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error; // Propagate the error to the parent promise
    }
  }

  async function fetchStats() {
    try {
      console.log('Fetching user stats');
      const session = await getCurrentSession();
      
      if (!session?.user) {
        console.log('No authenticated user found for stats');
        return;
      }
      
      // Add a race with timeout to prevent hanging
      const statsPromise = supabase
        .from('watched')
        .select('*')
        .eq('user_id', session.user.id);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stats query timed out')), 3000)
      );
      
      const { data: watched, error } = await Promise.race([
        statsPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      if (watched && watched.length > 0) {
        const totalWatched = watched.length;
        const avgRating = watched.reduce((acc: number, curr: WatchedItem) => acc + (curr.rating || 0), 0) / (totalWatched || 1);
        const watchTime = watched.reduce((acc: number, curr: WatchedItem) => acc + (curr.duration || 0), 0);

        setStats({
          totalWatched,
          avgRating: Math.round(avgRating * 10) / 10 || 0,
          watchTime: Math.round(watchTime / 60) || 0, // Convert to hours
        });
        console.log('Stats loaded successfully');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Don't propagate stats errors, they're non-critical
      // But we'll still show data that we have
    }
  }

  async function handleSignOut() {
    try {
      setLoading(true);
      
      // Force navigation to login page immediately, don't wait for logout to complete
      router.replace('/login');
      
      // Then perform logout in the background
      // The logout function has been improved to not get stuck and to clean up localStorage
      await logout().catch(error => {
        console.error('Error in logout (background):', error);
        // Errors are already handled in the logout function
      });
    } catch (error) {
      console.error('Error signing out:', error);
      // No need to navigate here as we already did it at the beginning
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator animating={true} size="large" color="#e21f70" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button 
          mode="contained" 
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchProfile().catch(() => setLoading(false));
            fetchStats().catch(() => {});
          }}
          style={styles.retryButton}
        >
          Retry
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.header} elevation={2}>
        <View style={styles.headerContent}>
          <Avatar.Image 
            size={100} 
            source={{ uri: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop' }} 
          />
          <Text variant="headlineMedium" style={styles.username}>{profile?.username || 'User'}</Text>
          <Text variant="bodyMedium" style={styles.email}>{profile?.email || ''}</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Settings size={24} color="#888" />
          </TouchableOpacity>
        </View>
      </Surface>

      <Card style={styles.statsCard}>
        <Card.Content style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text variant="headlineMedium" style={styles.statValue}>{stats.totalWatched}</Text>
            <Text variant="bodyMedium" style={styles.statLabel}>Watched</Text>
          </View>
          <Divider style={styles.statDivider} />
          <View style={styles.statBox}>
            <View style={styles.ratingContainer}>
              <Star size={16} color="#FFD700" fill="#FFD700" />
              <Text variant="headlineMedium" style={styles.statValue}>{stats.avgRating}</Text>
            </View>
            <Text variant="bodyMedium" style={styles.statLabel}>Avg Rating</Text>
          </View>
          <Divider style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text variant="headlineMedium" style={styles.statValue}>{stats.watchTime}h</Text>
            <Text variant="bodyMedium" style={styles.statLabel}>Watch Time</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Title title="Account Settings" />
        <Card.Content>
          <TouchableOpacity style={styles.menuItem}>
            <Text variant="bodyLarge" style={styles.menuText}>Edit Profile</Text>
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.menuItem}>
            <Text variant="bodyLarge" style={styles.menuText}>Notifications</Text>
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.menuItem}>
            <Text variant="bodyLarge" style={styles.menuText}>Privacy</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      <Button 
        mode="contained" 
        buttonColor="#e21f70"
        style={styles.signOutButton}
        icon={() => <LogOut size={20} color="#fff" />}
        onPress={handleSignOut}
        loading={loading}
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
  },
  errorText: {
    color: '#e21f70',
    marginBottom: 16,
    textAlign: 'center',
    padding: 16,
  },
  retryButton: {
    marginTop: 10,
  },
  header: {
    padding: 20,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
  },
  headerContent: {
    alignItems: 'center',
    position: 'relative',
  },
  username: {
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  email: {
    color: '#888',
    marginTop: 4,
  },
  settingsButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#fff',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: '#888',
    marginTop: 4,
  },
  statDivider: {
    height: '70%',
    width: 1,
    backgroundColor: '#2a2a2a',
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuText: {
    color: '#fff',
  },
  signOutButton: {
    margin: 16,
  },
});