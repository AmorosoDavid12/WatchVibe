import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Settings, LogOut, Star } from 'lucide-react-native';
import { Text, Button, Card, Avatar, ActivityIndicator, Divider, Surface } from 'react-native-paper';
import { signOut } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWatched: 0,
    avgRating: 0,
    watchTime: 0,
  });

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(data);
      setLoading(false);
    }
  }

  async function fetchStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: watched } = await supabase
        .from('watched')
        .select('*')
        .eq('user_id', user.id);

      if (watched) {
        const totalWatched = watched.length;
        const avgRating = watched.reduce((acc, curr) => acc + (curr.rating || 0), 0) / (totalWatched || 1);
        const watchTime = watched.reduce((acc, curr) => acc + (curr.duration || 0), 0);

        setStats({
          totalWatched,
          avgRating: Math.round(avgRating * 10) / 10 || 0,
          watchTime: Math.round(watchTime / 60) || 0, // Convert to hours
        });
      }
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
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