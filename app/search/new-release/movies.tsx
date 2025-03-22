import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { discoverContent, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';

export default function NewReleaseMoviesScreen() {
  const [newMovies, setNewMovies] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNewMovies = async () => {
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
        const response = await discoverContent('movie', {
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc',
          voteCountGte: 10, // Ensure some votes for quality
          page: 1
        });
        
        // Filter out animated content to match app's movies category
        const nonAnimatedMovies = response.results.filter(movie => {
          const isAnimation = movie.genre_ids?.includes(16);
          const isEnglish = (movie as any).original_language === 'en';
          return !isAnimation && isEnglish;
        });
        
        setNewMovies(nonAnimatedMovies);
        setError(null);
      } catch (err) {
        console.error('Error fetching new movies:', err);
        setError('Failed to load new movies. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNewMovies();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading new movies...</Text>
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

  if (newMovies.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No new movies found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={newMovies} isTrendingSection={false} />
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