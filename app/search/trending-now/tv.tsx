import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { getTrending, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';

export default function TrendingTVScreen() {
  const [trendingShows, setTrendingShows] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingTV = async () => {
      try {
        setLoading(true);
        // Fetch trending TV shows specifically
        const response = await getTrending('day', 'tv');
        setTrendingShows(response.results);
        setError(null);
      } catch (err) {
        console.error('Error fetching trending TV shows:', err);
        setError('Failed to load trending TV shows. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingTV();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading trending TV shows...</Text>
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

  if (trendingShows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trending TV shows found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={trendingShows} />
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