import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { getTopRated, discoverContent, TMDbSearchResult } from '../../../lib/tmdb';

// Import the MediaGrid component by relative path
import MediaGrid from './MediaGrid';

export default function HighestRatedAnime() {
  const [animeShows, setAnimeShows] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHighestRatedAnime() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch multiple pages of top rated TV shows
        const topRatedTVPage1 = await getTopRated('tv', 1);
        const topRatedTVPage2 = await getTopRated('tv', 2);
        
        // Combine results and ensure media_type is set
        const allTVShows = [
          ...topRatedTVPage1.results,
          ...topRatedTVPage2.results
        ].map(show => ({ ...show, media_type: 'tv' as const }));
        
        // Filter for anime (Japanese animation)
        const animeFiltered = allTVShows.filter(show => {
          // Identify anime as Japanese animation
          const isAnimation = show.genre_ids?.includes(16);
          const isJapanese = (show as any).original_language === 'ja';
          return isAnimation || (isJapanese && show.genre_ids?.includes(16));
        });
        
        // Sort by rating
        let sortedAnime = animeFiltered.sort((a, b) => b.vote_average - a.vote_average);
        
        // If not enough anime found in top_rated, use discover API
        if (sortedAnime.length < 10) {
          // Fallback to discover for anime
          const animeDiscover = await discoverContent('tv', {
            genreIds: [16],
            withOriginalLanguage: 'ja',
            sortBy: 'vote_average.desc',
            voteCountGte: 50,
            voteAverageGte: 7.0,
            page: 1
          });
          
          // Ensure media_type is set for all items
          const discoverResults = animeDiscover.results.map((show: any) => ({ 
            ...show, 
            media_type: 'tv' as const 
          }));
          
          // Combine and deduplicate results
          const combinedResults = [...sortedAnime];
          
          discoverResults.forEach((show: typeof sortedAnime[0]) => {
            if (!combinedResults.some(existing => existing.id === show.id)) {
              combinedResults.push(show);
            }
          });
          
          // Re-sort combined results
          sortedAnime = combinedResults.sort((a, b) => b.vote_average - a.vote_average);
        }
        
        setAnimeShows(sortedAnime);
      } catch (err) {
        console.error('Error fetching highest rated anime:', err);
        setError('Failed to load highest rated anime. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchHighestRatedAnime();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading highest rated anime...</Text>
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
      <MediaGrid data={animeShows} isHighestRatedSection={true} />
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