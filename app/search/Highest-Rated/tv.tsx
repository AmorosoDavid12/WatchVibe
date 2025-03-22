import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { getTopRated, TMDbSearchResult } from '../../../lib/tmdb';

// Import the MediaGrid component by relative path
import MediaGrid from './MediaGrid';

export default function HighestRatedTV() {
  const [tvShows, setTvShows] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHighestRatedTVShows() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch multiple pages of top rated TV shows
        const topRatedTVPage1 = await getTopRated('tv', 1);
        const topRatedTVPage2 = await getTopRated('tv', 2);
        const topRatedTVPage3 = await getTopRated('tv', 3);
        
        // Combine results and ensure media_type is set
        const allTVShows = [
          ...topRatedTVPage1.results,
          ...topRatedTVPage2.results,
          ...topRatedTVPage3.results
        ].map(show => ({ ...show, media_type: 'tv' as const }));
        
        // Filter but make language less restrictive
        const filteredTVShows = allTVShows.filter(show => {
          const isAnimation = show.genre_ids?.includes(16);
          
          // Keep any show regardless of language that has a vote average of 8.5+
          if (show.vote_average >= 8.5) {
            return !isAnimation; // For highly rated shows, only filter out animation
          }
          
          // For regular shows, prefer English but don't require it
          const isEnglish = (show as any).original_language === 'en';
          return !isAnimation && (isEnglish || show.vote_average >= 8.0);
        });
        
        // Sort by rating
        const sortedTVShows = filteredTVShows.sort((a, b) => b.vote_average - a.vote_average);
        
        setTvShows(sortedTVShows);
      } catch (err) {
        console.error('Error fetching highest rated TV shows:', err);
        setError('Failed to load highest rated TV shows. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchHighestRatedTVShows();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading highest rated TV shows...</Text>
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
      <MediaGrid data={tvShows} isHighestRatedSection={true} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingBottom: 59,
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