import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { TMDbSearchResult, discoverContent } from '../../../lib/tmdb';
import MediaGrid from './MediaGrid';
import { useWatchlistStore, WatchlistItem } from '../../../lib/watchlistStore';
import { useWatchedStore } from '../../../lib/watchedStore';

// Extended item type that might have genre_ids
interface ExtendedItem extends WatchlistItem {
  genre_ids?: number[];
}

export default function ForYouTVScreen() {
  const [recommendations, setRecommendations] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { items: watchlistItems } = useWatchlistStore();
  const { items: watchedItems } = useWatchedStore();

  useEffect(() => {
    const generateTVRecommendations = async () => {
      try {
        setLoading(true);
        
        // Get genres from user's watchlist and watched items
        const userItems = [...watchlistItems, ...watchedItems] as ExtendedItem[];
        
        // Filter to only TV shows
        const userTVItems = userItems.filter(item => item.media_type === 'tv');
        
        if (userTVItems.length === 0) {
          // If no watched/watchlist TV items, fetch popular TV shows
          const popularTV = await discoverContent('tv', {
            sortBy: 'popularity.desc',
            voteCountGte: 200,
            page: 1
          });
          
          setRecommendations(popularTV.results);
          setError(null);
          setLoading(false);
          return;
        }
        
        // Extract genre IDs from user items
        const genreIds = new Set<number>();
        userTVItems.forEach(item => {
          if (item.genre_ids && Array.isArray(item.genre_ids)) {
            item.genre_ids.forEach((id: number) => genreIds.add(id));
          }
        });
        
        // Get most watched genres (top 4)
        const topGenres = Array.from(genreIds).slice(0, 4);
        
        // Fetch recommendations based on favorite genres
        const recommendationPromises = [
          discoverContent('tv', {
            genreIds: topGenres,
            sortBy: 'vote_average.desc',
            voteCountGte: 100,
            voteAverageGte: 7.0,
            page: 1
          }),
          discoverContent('tv', {
            genreIds: topGenres,
            sortBy: 'popularity.desc',
            voteCountGte: 100,
            page: 1
          })
        ];
        
        const results = await Promise.all(recommendationPromises);
        
        // Combine results, remove duplicates, and filter out items already in watchlist/watched
        const combinedResults: TMDbSearchResult[] = [];
        const userItemIds = new Set(userItems.map(item => item.id));
        
        results.forEach(response => {
          response.results.forEach(item => {
            // Skip if already in user's list or already added to recommendations
            if (userItemIds.has(item.id) || combinedResults.some(r => r.id === item.id)) {
              return;
            }
            // Set the media_type to ensure it's correct
            item.media_type = 'tv';
            combinedResults.push(item);
          });
        });
        
        // Sort by rating and popularity for best recommendations
        const sortedRecommendations = combinedResults
          .sort((a, b) => {
            // First by rating
            const ratingDiff = b.vote_average - a.vote_average;
            if (Math.abs(ratingDiff) > 0.5) return ratingDiff;
            // Then by popularity if ratings are close
            return (b.popularity || 0) - (a.popularity || 0);
          })
          .slice(0, 40); // Limit to 40 items for performance
        
        setRecommendations(sortedRecommendations);
        setError(null);
      } catch (err) {
        console.error('Error generating TV recommendations:', err);
        setError('Failed to load personalized TV recommendations. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    generateTVRecommendations();
  }, [watchlistItems, watchedItems]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Generating your TV recommendations...</Text>
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

  if (recommendations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No TV recommendations found. Try adding more TV shows to your watchlist.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediaGrid data={recommendations} isTrendingSection={false} />
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