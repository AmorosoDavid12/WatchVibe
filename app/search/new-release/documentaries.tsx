import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { discoverContent, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';

export default function NewReleaseDocumentariesScreen() {
  const [newDocumentaries, setNewDocumentaries] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNewDocumentaries = async () => {
      try {
        setLoading(true);
        
        // Get current date and calculate date 3 months ago
        const today = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        
        // Format dates for API
        const fromDate = threeMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD
        const toDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Fetch recently released documentary movies
        const docMovies = await discoverContent('movie', {
          genreIds: [99], // Documentary genre
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc',
          voteCountGte: 5, // Lower threshold for documentaries
          page: 1
        });
        
        // Fetch recently released documentary TV shows
        const docTV = await discoverContent('tv', {
          genreIds: [99], // Documentary genre
          releaseDateGte: fromDate,
          releaseDateLte: toDate,
          sortBy: 'popularity.desc',
          voteCountGte: 5, // Lower threshold for documentaries
          page: 1
        });
        
        // Combine and sort by popularity
        const combinedDocs = [...docMovies.results, ...docTV.results]
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        setNewDocumentaries(combinedDocs);
        setError(null);
      } catch (err) {
        console.error('Error fetching new documentaries:', err);
        setError('Failed to load new documentaries. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNewDocumentaries();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading new documentaries...</Text>
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

  if (newDocumentaries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No new documentaries found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={newDocumentaries} isTrendingSection={false} />
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