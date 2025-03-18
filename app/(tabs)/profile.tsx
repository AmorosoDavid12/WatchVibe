import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, getCurrentSession, verifyAuthState } from '@/lib/supabase';
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

const MAX_RETRIES = 2;

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchRetryCount, setFetchRetryCount] = useState(0);
  const [stats, setStats] = useState({
    totalWatched: 0,
    avgRating: 0,
    watchTime: 0,
  });

  // Use an additional state to track if the component is mounted
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    // Set mounted flag
    setIsMounted(true);
    
    const initializeProfile = async () => {
      // Verify auth state first - this will refresh the token if needed
      const isAuthenticated = await verifyAuthState();
      
      if (!isAuthenticated) {
        console.log('Auth verification failed, redirecting to login');
        router.replace('/login');
        return;
      }
      
      // For debugging: check if the user_items table exists
      checkTableStructure();
      
      // Load profile data with retry mechanism
      loadProfileData();
    };
    
    initializeProfile();

    // Cleanup function to prevent state updates after unmount
    return () => {
      setIsMounted(false);
    };
  }, []);

  const checkTableStructure = async () => {
    try {
      console.log('Checking table structure...');
      const { data, error } = await supabase
        .from('user_items')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('Error checking table structure:', error);
      } else {
        console.log('Table exists, sample data:', data);
      }
    } catch (err) {
      console.error('Failed to check table structure:', err);
    }
  };
  
  const loadProfileData = async () => {
    // Set a timeout for the entire loading process
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        console.log('Profile data loading timed out');
        
        if (fetchRetryCount < MAX_RETRIES) {
          console.log(`Retrying profile data load (${fetchRetryCount + 1}/${MAX_RETRIES})`);
          setFetchRetryCount(prev => prev + 1);
          loadProfileData();
        } else {
          setLoading(false);
          setError('Loading timed out. Please try again.');
        }
      }
    }, 8000);

    try {
      // Run both fetch operations in parallel
      await Promise.all([
        fetchProfile(),
        fetchStats()
      ]);
      
      // Only update state if component is still mounted
      if (isMounted) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      // Only update state if component is still mounted
      if (isMounted) {
        // Try one more time if we haven't reached max retries
        if (fetchRetryCount < MAX_RETRIES) {
          console.log(`Error occurred, retrying profile load (${fetchRetryCount + 1}/${MAX_RETRIES})`);
          setFetchRetryCount(prev => prev + 1);
          setTimeout(loadProfileData, 1000); // Wait 1 second before retrying
        } else {
          setError('Failed to load profile data');
          setLoading(false);
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  async function fetchProfile() {
    try {
      console.log('Fetching user profile data');
      // Use our enhanced getCurrentSession instead of direct Supabase call
      const session = await getCurrentSession();
      
      if (session?.user && isMounted) {
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
        .from('user_items')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('type', 'watched');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stats query timed out')), 5000)
      );
      
      const { data: watched, error } = await Promise.race([
        statsPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      if (watched && watched.length > 0 && isMounted) {
        const parsedWatched = watched.map((item: any) => {
          try {
            return JSON.parse(item.value);
          } catch (e) {
            console.error('Error parsing watched item:', e);
            return null;
          }
        }).filter(Boolean);

        const totalWatched = parsedWatched.length;
        const avgRating = parsedWatched.reduce((acc: number, curr: WatchedItem) => acc + (curr.rating || 0), 0) / (totalWatched || 1);
        const watchTime = parsedWatched.reduce((acc: number, curr: WatchedItem) => acc + (curr.duration || 0), 0);

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

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setFetchRetryCount(0);
    loadProfileData();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator animating={true} size="large" color="#e21f70" />
        <Text style={styles.loadingText}>
          {fetchRetryCount > 0 ? `Loading profile... (Attempt ${fetchRetryCount + 1})` : 'Loading profile...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button 
          mode="contained" 
          onPress={handleRetry}
          style={styles.retryButton}
        >
          Retry
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.header}>
        <Card.Content style={styles.headerContent}>
          <Avatar.Image 
            size={100} 
            source={{ uri: profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop' }} 
          />
          <Text variant="headlineMedium" style={styles.username}>{profile?.username || 'User'}</Text>
          <Text variant="bodyMedium" style={styles.email}>{profile?.email || ''}</Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            accessibilityRole="button"
          >
            <Settings size={24} color="#888" />
          </TouchableOpacity>
        </Card.Content>
      </Card>

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

// Platform-specific elevation styles to handle web vs native differences
const getElevation = (value: number) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${value}px ${value * 2}px rgba(0,0,0,0.2)`,
    };
  }
  return {
    elevation: value,
  };
};

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
    marginHorizontal: 16,
    marginTop: 16,
    ...getElevation(2),
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
    ...getElevation(1),
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
    // Use marginLeft instead of gap for better compatibility
    marginLeft: 4,
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
    ...getElevation(1),
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