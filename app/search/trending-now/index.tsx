import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, ScrollView } from 'react-native';
import { getTrending, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';
import { useRouter } from 'expo-router';
import { ChevronRight, Film, Tv, Monitor, BookOpen } from 'lucide-react-native';

export default function TrendingNowScreen() {
  const [trendingItems, setTrendingItems] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchTrendingContent = async () => {
      try {
        setLoading(true);
        
        // Fetch trending content from all three endpoints
        const [allTrending, moviesTrending, tvTrending] = await Promise.all([
          getTrending('day', 'all'),
          getTrending('day', 'movie'),
          getTrending('day', 'tv')
        ]);
        
        // Filter out 'person' type from allTrending
        const filteredAll = allTrending.results.filter(item => item.media_type !== 'person');
        
        // Make sure each item has its media_type set correctly
        const moviesWithType = moviesTrending.results.map(item => ({
          ...item,
          media_type: 'movie' as 'movie'
        }));
        
        const tvWithType = tvTrending.results.map(item => ({
          ...item,
          media_type: 'tv' as 'tv'
        }));
        
        // Combine all results and remove duplicates by ID
        const allItems = [...filteredAll, ...moviesWithType, ...tvWithType];
        const uniqueItems = Array.from(
          new Map(allItems.map(item => [item.id, item])).values()
        ) as TMDbSearchResult[];
        
        // Sort by popularity
        const sortedItems = uniqueItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        setTrendingItems(sortedItems);
        setError(null);
      } catch (err) {
        console.error('Error fetching trending content:', err);
        setError('Failed to load trending content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingContent();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading trending content...</Text>
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

  if (trendingItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trending content found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Category navigation buttons */}
      <View style={styles.categoryButtons}>
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/trending-now/movies' })}
        >
          <Film size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>Movies</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/trending-now/tv' })}
        >
          <Tv size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>TV Shows</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/trending-now/anime' })}
        >
          <Monitor size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>Anime</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.categoryButton}
          onPress={() => router.push({ pathname: '/search/trending-now/documentaries' })}
        >
          <BookOpen size={20} color="#fff" />
          <Text style={styles.categoryButtonText}>Documentaries</Text>
          <ChevronRight size={16} color="#666" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sectionTitle}>All Trending Content</Text>
      
      <MediaGrid data={trendingItems} isTrendingSection={true} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
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
    color: '#ff6b6b',
    textAlign: 'center',
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 16,
  },
  categoryButtons: {
    marginTop: 10,
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
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
  },
}); 