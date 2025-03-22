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

export default function ForYouAllScreen() {
  const [recommendations, setRecommendations] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { items: watchlistItems } = useWatchlistStore();
  const { items: watchedItems } = useWatchedStore();

  useEffect(() => {
    const generateRecommendations = async () => {
      try {
        setLoading(true);
        
        // Get genres from user's watchlist and watched items
        const userItems = [...watchlistItems, ...watchedItems] as ExtendedItem[];
        
        if (userItems.length === 0) {
          // If no watched/watchlist items, fetch popular content
          const popularMovies = await discoverContent('movie', {
            sortBy: 'popularity.desc',
            voteCountGte: 200,
            page: 1
          });
          
          const popularTV = await discoverContent('tv', {
            sortBy: 'popularity.desc',
            voteCountGte: 200,
            page: 1
          });
          
          // Combine and shuffle
          const combined = [...popularMovies.results, ...popularTV.results];
          const shuffled = combined.sort(() => 0.5 - Math.random()).slice(0, 50); // Show more items in All view
          
          setRecommendations(shuffled);
          setError(null);
          setLoading(false);
          return;
        }
        
        // Extract genre IDs from user items
        const genreIds = new Set<number>();
        userItems.forEach(item => {
          if (item.genre_ids && Array.isArray(item.genre_ids)) {
            item.genre_ids.forEach((id: number) => genreIds.add(id));
          }
        });
        
        // Get most watched genres (top 5 for all view)
        const topGenres = Array.from(genreIds).slice(0, 5);
        
        // Get media types the user watches
        const watchesMovies = userItems.some(item => item.media_type === 'movie');
        const watchesTV = userItems.some(item => item.media_type === 'tv');
        
        // Fetch recommendations based on favorite genres
        const recommendationPromises = [];
        
        if (watchesMovies) {
          // Get multiple pages for "All" view
          recommendationPromises.push(
            discoverContent('movie', {
              genreIds: topGenres,
              sortBy: 'vote_average.desc',
              voteCountGte: 100,
              voteAverageGte: 7.0,
              page: 1
            }),
            discoverContent('movie', {
              genreIds: topGenres,
              sortBy: 'vote_average.desc',
              voteCountGte: 100,
              voteAverageGte: 7.0,
              page: 2
            })
          );
        }
        
        if (watchesTV) {
          recommendationPromises.push(
            discoverContent('tv', {
              genreIds: topGenres,
              sortBy: 'vote_average.desc',
              voteCountGte: 100,
              voteAverageGte: 7.0,
              page: 1
            }),
            discoverContent('tv', {
              genreIds: topGenres,
              sortBy: 'vote_average.desc',
              voteCountGte: 100,
              voteAverageGte: 7.0,
              page: 2
            })
          );
        }
        
        // If no preferences detected, get both movies and TV
        if (!watchesMovies && !watchesTV) {
          recommendationPromises.push(
            discoverContent('movie', { 
              sortBy: 'popularity.desc',
              voteCountGte: 200,
              page: 1
            }),
            discoverContent('tv', {
              sortBy: 'popularity.desc',
              voteCountGte: 200,
              page: 1
            }),
            discoverContent('movie', { 
              sortBy: 'popularity.desc',
              voteCountGte: 200,
              page: 2
            }),
            discoverContent('tv', {
              sortBy: 'popularity.desc',
              voteCountGte: 200,
              page: 2
            })
          );
        }
        
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
          .slice(0, 80); // Show more items in the All view
        
        setRecommendations(sortedRecommendations);
        setError(null);
      } catch (err) {
        console.error('Error generating recommendations:', err);
        setError('Failed to load personalized recommendations. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    generateRecommendations();
  }, [watchlistItems, watchedItems]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Generating your recommendations...</Text>
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
        <Text style={styles.emptyText}>No recommendations found. Try adding more titles to your watchlist.</Text>
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