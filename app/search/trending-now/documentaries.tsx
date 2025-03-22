import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { getTrending, discoverContent, TMDbSearchResult } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';

export default function TrendingDocumentariesScreen() {
  const [trendingDocs, setTrendingDocs] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingDocumentaries = async () => {
      try {
        setLoading(true);
        
        // Fetch from multiple endpoints
        const [allTrending, movieTrending, tvTrending] = await Promise.all([
          getTrending('day', 'all'),
          getTrending('day', 'movie'),
          getTrending('day', 'tv')
        ]);
        
        // Filter for documentary content (genre ID 99)
        const docsFromAll = allTrending.results.filter(item => 
          item.genre_ids?.includes(99)
        );
        
        const docsFromMovies = movieTrending.results.filter(item => 
          item.genre_ids?.includes(99)
        ).map(item => ({
          ...item, 
          media_type: 'movie' as 'movie'
        }));
        
        const docsFromTV = tvTrending.results.filter(item => 
          item.genre_ids?.includes(99)
        ).map(item => ({
          ...item, 
          media_type: 'tv' as 'tv'
        }));
        
        // Also fetch dedicated documentary content from discover endpoint
        const movieDocs = await discoverContent('movie', {
          genreIds: [99], // Documentary genre
          sortBy: 'popularity.desc',
          voteCountGte: 10
        });
        
        const tvDocs = await discoverContent('tv', {
          genreIds: [99], // Documentary genre for TV
          sortBy: 'popularity.desc',
          voteCountGte: 10
        });
        
        // Combine all results and remove duplicates
        const allDocs = [...docsFromAll, ...docsFromMovies, ...docsFromTV, 
                         ...movieDocs.results, ...tvDocs.results];
        
        // Remove duplicates by ID
        const uniqueDocs = Array.from(
          new Map(allDocs.map(item => [item.id, item])).values()
        ) as TMDbSearchResult[];
        
        // Sort by popularity
        const sortedDocs = uniqueDocs.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        setTrendingDocs(sortedDocs);
        setError(null);
      } catch (err) {
        console.error('Error fetching trending documentaries:', err);
        setError('Failed to load trending documentaries. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingDocumentaries();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading trending documentaries...</Text>
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

  if (trendingDocs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trending documentaries found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={trendingDocs} isTrendingSection={true} />
    </View>
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