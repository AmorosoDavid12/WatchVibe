import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, getCurrentSession, verifyAuthState, fetchUserItems, logout } from '@/lib/supabase';
import { Settings, LogOut, Star, Smartphone, Monitor } from 'lucide-react-native';
import { Text, Button, Card, Avatar, ActivityIndicator, Divider, Surface } from 'react-native-paper';

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
  const [stats, setStats] = useState({
    totalWatched: 0,
    avgRating: 0,
    watchTime: 0,
  });
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Verify auth first
        const isAuthenticated = await verifyAuthState();
        if (!isAuthenticated) {
          router.replace('/login');
          return;
        }
        
        // Load profile and stats in parallel
        await Promise.all([
          fetchProfile(),
          fetchStats()
        ]);
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data');
        setLoading(false);
      }
    };
    
    loadProfile();
  }, []);

  async function fetchProfile() {
    const session = await getCurrentSession();
    
    if (!session?.user) {
      throw new Error('No authenticated user');
    }
    
    const user = session.user;
    setProfile({
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
      avatar_url: user.user_metadata?.avatar_url
    });
  }

  async function fetchStats() {
    const session = await getCurrentSession();
    
    if (!session?.user) {
      return;
    }
    
    try {
      // Use fetchUserItems from supabase.ts
      const watchedItems = await fetchUserItems(session.user.id, 'watched');
      
      if (watchedItems && watchedItems.length > 0) {
        const totalWatched = watchedItems.length;
        const avgRating = watchedItems.reduce((acc: number, curr: WatchedItem) => 
          acc + (curr.rating || 0), 0) / (totalWatched || 1);
        const watchTime = watchedItems.reduce((acc: number, curr: WatchedItem) => 
          acc + (curr.duration || 0), 0);

        setStats({
          totalWatched,
          avgRating: Math.round(avgRating * 10) / 10 || 0,
          watchTime: Math.round(watchTime / 60) || 0, // Convert to hours
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      // Non-critical, continue without stats
    }
  }

  async function handleSignOut() {
    try {
      setLoading(true);
      setLogoutModalVisible(false);
      
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    loadProfile();
  };

  // Function to load profile and stats
  async function loadProfile() {
    try {
      await Promise.all([
        fetchProfile(),
        fetchStats()
      ]);
      
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error retrying profile load:', err);
      setError('Failed to load profile data');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator animating={true} size="large" color="#e21f70" />
        <Text style={styles.loadingText}>
          {error ? error : 'Loading profile...'}
        </Text>
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
        onPress={() => setLogoutModalVisible(true)}
        loading={loading}
      >
        Sign Out
      </Button>

      {/* Logout Modal - Simplified to one option */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setLogoutModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalText}>Are you sure you want to sign out?</Text>
            
            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setLogoutModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              
              <Button
                mode="contained"
                onPress={() => handleSignOut()}
                style={[styles.modalButton, styles.signOutButton]}
                loading={loading}
                disabled={loading}
              >
                Sign Out
              </Button>
            </View>
          </View>
        </Pressable>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 20,
    ...getElevation(4),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    color: '#fff',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});