import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { discoverContent, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';

export default function NewReleaseAnimeScreen() {
  const [newAnime, setNewAnime] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNewAnime = async () => {
      try {
        setLoading(true);
        
        // Get current date and calculate date 3 months ago
        const today = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        
        // Format dates for API
        const fromDate = threeMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD
        const toDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Fetch recently released anime TV shows (most anime is TV)
        const animeTV = await discoverContent('tv', {
          genreIds: [16], // Animation genre
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc',
          voteCountGte: 5, // Lower threshold for anime
          page: 1
        });
        
        // Fetch recently released anime movies
        const animeMovies = await discoverContent('movie', {
          genreIds: [16], // Animation genre
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc',
          voteCountGte: 5, // Lower threshold for anime
          page: 1
        });
        
        // Filter for anime content - using language to help identify anime
        const animeContent = [...animeTV.results, ...animeMovies.results].filter(item => {
          const isAnimation = item.genre_ids?.includes(16);
          const isAsian = ['ja', 'ko', 'zh'].includes((item as any).original_language);
          
          // Include any animation that's from Japan/Korea/China
          return isAnimation && isAsian;
        });
        
        // Sort by popularity
        const sortedAnime = animeContent.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        setNewAnime(sortedAnime);
        setError(null);
      } catch (err) {
        console.error('Error fetching new anime:', err);
        setError('Failed to load new anime. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNewAnime();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading new anime...</Text>
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

  if (newAnime.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No new anime found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={newAnime} isTrendingSection={false} />
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