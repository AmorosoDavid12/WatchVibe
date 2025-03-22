import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { discoverContent, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';

export default function NewReleaseTVScreen() {
  const [newTVShows, setNewTVShows] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNewTVShows = async () => {
      try {
        setLoading(true);
        
        // Get current date and calculate date 3 months ago
        const today = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        
        // Format dates for API
        const fromDate = threeMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD
        const toDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Fetch recently released TV shows
        const response = await discoverContent('tv', {
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc',
          voteCountGte: 10, // Ensure some votes for quality
          page: 1
        });
        
        // Filter out animated content to match app's TV category
        const nonAnimatedTV = response.results.filter(show => {
          const isAnimation = show.genre_ids?.includes(16);
          const isEnglish = (show as any).original_language === 'en';
          return !isAnimation && isEnglish;
        });
        
        setNewTVShows(nonAnimatedTV);
        setError(null);
      } catch (err) {
        console.error('Error fetching new TV shows:', err);
        setError('Failed to load new TV shows. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNewTVShows();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading new TV shows...</Text>
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

  if (newTVShows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No new TV shows found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={newTVShows} isTrendingSection={false} />
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