import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { getTopRated, TMDbSearchResult } from '../../../lib/tmdb';

// Import the MediaGrid component by relative path
import MediaGrid from './MediaGrid';

export default function HighestRatedMovies() {
  const [movies, setMovies] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHighestRatedMovies() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch multiple pages of top rated movies
        const topRatedMoviesPage1 = await getTopRated('movie', 1);
        const topRatedMoviesPage2 = await getTopRated('movie', 2);
        
        // Combine results and ensure media_type is set
        const allMovies = [
          ...topRatedMoviesPage1.results,
          ...topRatedMoviesPage2.results
        ].map(movie => ({ ...movie, media_type: 'movie' as const }));
        
        // Filter for non-animated English movies
        const filteredMovies = allMovies.filter(movie => {
          const isAnimation = movie.genre_ids?.includes(16);
          // Check if original language property exists and is English
          const isEnglish = (movie as any).original_language === 'en';
          return !isAnimation && isEnglish;
        });
        
        // Sort by rating
        const sortedMovies = filteredMovies.sort((a, b) => b.vote_average - a.vote_average);
        
        setMovies(sortedMovies);
      } catch (err) {
        console.error('Error fetching highest rated movies:', err);
        setError('Failed to load highest rated movies. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchHighestRatedMovies();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading highest rated movies...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={movies} isHighestRatedSection={true} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    color: '#ff5252',
    fontSize: 16,
    textAlign: 'center',
  },
}); 