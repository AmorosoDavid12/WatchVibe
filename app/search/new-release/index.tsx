import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, ScrollView } from 'react-native';
import { discoverContent, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';
import { useRouter } from 'expo-router';
import { ChevronRight, Film, Tv, Monitor, BookOpen } from 'lucide-react-native';

export default function NewReleaseScreen() {
  const [newReleases, setNewReleases] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchNewReleases = async () => {
      try {
        setLoading(true);
        
        // Get current date and calculate date 3 months ago
        const today = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        
        // Format dates for API
        const fromDate = threeMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD
        const toDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Fetch recently released movies
        const newMovies = await discoverContent('movie', {
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc',
          voteCountGte: 10, // Ensure some votes for quality
          page: 1
        });
        
        // Fetch recently released TV shows
        const newTVShows = await discoverContent('tv', {
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc', 
          voteCountGte: 10,
          page: 1
        });
        
        // Combine and sort results by popularity
        const combined = [...newMovies.results, ...newTVShows.results]
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        // Make sure each item has its media_type set
        const combinedWithMediaType = combined.map(item => {
          if (!item.media_type) {
            item.media_type = item.title ? 'movie' : 'tv';
          }
          return item;
        });
        
        setNewReleases(combinedWithMediaType);
        setError(null);
      } catch (err) {
        console.error('Error fetching new releases:', err);
        setError('Failed to load new releases. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNewReleases();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading new releases...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (newReleases.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No new releases found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Category navigation buttons */}
      <View style={styles.categoryButtons}>
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/new-release/movies' })}
        >
          <Film size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>Movies</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/new-release/tv' })}
        >
          <Tv size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>TV Shows</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/new-release/anime' })}
        >
          <Monitor size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>Anime</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/new-release/documentaries' })}
        >
          <BookOpen size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>Documentaries</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sectionTitle}>All New Releases</Text>
      
      <MediaGrid data={newReleases} isTrendingSection={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  emptyText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  categoryButtons: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  categoryButtonText: {
    color: '#fff',
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 16,
    marginTop: 8,
    marginBottom: 8,
  },
}); 