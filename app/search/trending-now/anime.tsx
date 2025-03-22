import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { getTrending, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';

export default function TrendingAnimeScreen() {
  const [trendingAnime, setTrendingAnime] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingAnime = async () => {
      try {
        setLoading(true);
        // First fetch all trending content
        const response = await getTrending('day', 'all');
        
        // Filter for anime content
        // Anime is considered: animation genre OR Japanese/Korean/Chinese origin
        const animeContent = response.results.filter(item => {
          const isAnimation = item.genre_ids?.includes(16);
          const isAsian = ['ja', 'ko', 'zh'].includes((item as any).original_language);
          
          // Include any animation OR any Japanese/Korean/Chinese content
          return isAnimation || isAsian;
        });
        
        setTrendingAnime(animeContent);
        setError(null);
      } catch (err) {
        console.error('Error fetching trending anime:', err);
        setError('Failed to load trending anime. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingAnime();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading trending anime...</Text>
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

  if (trendingAnime.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trending anime found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={trendingAnime} />
    </View>
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
}); 