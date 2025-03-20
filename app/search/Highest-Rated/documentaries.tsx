import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { getTopRated, discoverContent, TMDbSearchResult } from '../../../lib/tmdb';

// Import the MediaGrid component by relative path
import MediaGrid from './MediaGrid';

export default function HighestRatedDocumentaries() {
  const [documentaries, setDocumentaries] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHighestRatedDocumentaries() {
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
        
        // Filter for documentaries (genre ID 99)
        const documentariesFiltered = allMovies.filter(movie => {
          return movie.genre_ids?.includes(99);
        });
        
        // Sort by rating
        let sortedDocumentaries = documentariesFiltered.sort((a, b) => b.vote_average - a.vote_average);
        
        // If not enough documentaries found in top_rated, use discover API
        if (sortedDocumentaries.length < 10) {
          // Fallback to discover for documentaries
          const docsDiscover = await discoverContent('movie', {
            genreIds: [99],
            sortBy: 'vote_average.desc',
            voteCountGte: 100,
            voteAverageGte: 7.0,
            page: 1
          });
          
          // Ensure media_type is set for all items
          const discoverResults = docsDiscover.results.map((movie: any) => ({ 
            ...movie, 
            media_type: 'movie' as const 
          }));
          
          // Combine and deduplicate results
          const combinedResults = [...sortedDocumentaries];
          
          discoverResults.forEach((movie: typeof sortedDocumentaries[0]) => {
            if (!combinedResults.some(existing => existing.id === movie.id)) {
              combinedResults.push(movie);
            }
          });
          
          // Re-sort combined results
          sortedDocumentaries = combinedResults.sort((a, b) => b.vote_average - a.vote_average);
        }
        
        setDocumentaries(sortedDocumentaries);
      } catch (err) {
        console.error('Error fetching highest rated documentaries:', err);
        setError('Failed to load highest rated documentaries. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchHighestRatedDocumentaries();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading highest rated documentaries...</Text>
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
      <MediaGrid data={documentaries} isHighestRatedSection={true} />
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