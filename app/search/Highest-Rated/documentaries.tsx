import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, ScrollView } from 'react-native';
import { getTopRated, discoverContent, getTrending, TMDbSearchResult } from '../../../lib/tmdb';

// Import the MediaGrid component by relative path
import MediaGrid from './MediaGrid';

export default function HighestRatedDocumentaries() {
  const [documentaries, setDocumentaries] = useState<TMDbSearchResult[]>([]);
  const [trendingDocumentaries, setTrendingDocumentaries] = useState<TMDbSearchResult[]>([]);
  const [newReleaseDocumentaries, setNewReleaseDocumentaries] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllDocumentaries() {
      try {
        setLoading(true);
        setError(null);
        
        // 1. FETCH HIGHEST RATED DOCUMENTARIES
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
        
        // 2. FETCH TRENDING DOCUMENTARIES
        // Use trending movies and filter for documentaries
        const trendingMovies = await getTrending('week', 'movie', 1, 'en-US');
        const trendingTV = await getTrending('week', 'tv', 1, 'en-US');
        
        // Combine results and filter for documentaries
        const allTrendingContent = [
          ...trendingMovies.results.map(movie => ({ ...movie, media_type: 'movie' as const })),
          ...trendingTV.results.map(show => ({ ...show, media_type: 'tv' as const }))
        ].filter(item => item.genre_ids?.includes(99));
        
        // If not enough trending documentaries, use documentary discover with popularity sort
        if (allTrendingContent.length < 8) {
          const popularDocs = await discoverContent('movie', {
            genreIds: [99],
            sortBy: 'popularity.desc',
            voteCountGte: 50,
            page: 1
          });
          
          const tvDocs = await discoverContent('tv', {
            genreIds: [99],
            sortBy: 'popularity.desc',
            voteCountGte: 30,
            page: 1
          });
          
          // Combine results
          const moreTrendingDocs = [
            ...popularDocs.results.map(movie => ({ ...movie, media_type: 'movie' as const })),
            ...tvDocs.results.map(show => ({ ...show, media_type: 'tv' as const }))
          ];
          
          // Add unique items
          moreTrendingDocs.forEach(item => {
            if (!allTrendingContent.some(existing => existing.id === item.id)) {
              allTrendingContent.push(item);
            }
          });
        }
        
        // Sort by popularity
        const sortedTrending = allTrendingContent.sort((a, b) => 
          (b.popularity || 0) - (a.popularity || 0)
        );
        
        setTrendingDocumentaries(sortedTrending);
        
        // 3. FETCH NEW RELEASE DOCUMENTARIES
        // Get recent documentary releases using the discover API
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        const dateThreshold = sixMonthsAgo.toISOString().split('T')[0];
        
        const newReleaseMovieDocs = await discoverContent('movie', {
          genreIds: [99],
          sortBy: 'primary_release_date.desc',
          releaseDateGte: dateThreshold,
          voteCountGte: 20,
          page: 1
        });
        
        const newReleaseTVDocs = await discoverContent('tv', {
          genreIds: [99],
          sortBy: 'first_air_date.desc',
          releaseDateGte: dateThreshold,
          voteCountGte: 10,
          page: 1
        });
        
        // Combine results
        const allNewReleases = [
          ...newReleaseMovieDocs.results.map(movie => ({ ...movie, media_type: 'movie' as const })),
          ...newReleaseTVDocs.results.map(show => ({ ...show, media_type: 'tv' as const }))
        ];
        
        // Sort by release date (newest first)
        const sortedNewReleases = allNewReleases.sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || '');
          const dateB = new Date(b.release_date || b.first_air_date || '');
          return dateB.getTime() - dateA.getTime();
        });
        
        setNewReleaseDocumentaries(sortedNewReleases);
      } catch (err) {
        console.error('Error fetching documentaries:', err);
        setError('Failed to load documentaries. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchAllDocumentaries();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading documentaries...</Text>
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
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Highest Rated Documentaries</Text>
          <MediaGrid data={documentaries} isHighestRatedSection={true} />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending Documentaries</Text>
          <MediaGrid data={trendingDocumentaries} isHighestRatedSection={false} />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Documentaries</Text>
          <MediaGrid data={newReleaseDocumentaries} isHighestRatedSection={false} />
        </View>
      </ScrollView>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginBottom: 12,
  },
}); 