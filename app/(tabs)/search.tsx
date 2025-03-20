import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { useWatchlistStore, WatchlistItem } from '../../lib/watchlistStore';
import { searchContent, formatSearchResult, TMDbSearchResult, getTrending, getMovieDetails, discoverContent, getTopRated } from '../../lib/tmdb';
import { Plus, Check, Film, Tv, Repeat, Search, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { debounce } from 'lodash';
import Toast from 'react-native-toast-message';
import { useWatchedStore, WatchedItem } from '@/lib/watchedStore';

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const ITEM_WIDTH = (width - 48) / COLUMN_COUNT; // 48 = padding (16) * 2 + gap (16)

// Handler for toast notifications
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  Toast.show({
    type,
    text1: message,
    position: 'bottom',
    visibilityTime: 1000, // 1 second
    autoHide: true,
  });
};

type CategoryType = 'all' | 'movies' | 'tv' | 'anime' | 'documentaries';

// Platform-specific elevation styles to handle web vs native differences
const getElevation = (value: number) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${value}px ${value * 2}px rgba(0,0,0,0.2)`,
    };
  }
  return {
    elevation: value,
  };
};

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<TMDbSearchResult[]>([]);
  const [trendingItems, setTrendingItems] = useState<TMDbSearchResult[]>([]);
  const [newReleases, setNewReleases] = useState<TMDbSearchResult[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<TMDbSearchResult[]>([]);
  const [spotlightItem, setSpotlightItem] = useState<TMDbSearchResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store original data for filtering operations
  const originalTrendingItems = useRef<TMDbSearchResult[]>([]);
  const originalRecommendedItems = useRef<TMDbSearchResult[]>([]);
  const originalNewReleases = useRef<TMDbSearchResult[]>([]);
  
  // Track previously shown spotlight items to avoid repetition
  const [recentSpotlightIds] = useState<Set<number>>(new Set());
  
  // Animation values for button transitions
  const spotlightButtonScale = useRef(new Animated.Value(1)).current;
  const spotlightButtonColor = useRef(new Animated.Value(0)).current;
  const spotlightButtonRotation = useRef(new Animated.Value(0)).current;
  
  const { addItem: addToWatchlist, hasItem: isInWatchlist } = useWatchlistStore();
  const { hasItem: isInWatched, removeItem: removeFromWatched } = useWatchedStore();
  const router = useRouter();

  // Add a dedicated ref for storing the highest rated content
  const originalHighestRatedItems = useRef<TMDbSearchResult[]>([]);

  // Save search state to localStorage/sessionStorage when it changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // Save search state
        if (query) {
          localStorage.setItem('search_query', query);
          localStorage.setItem('search_active', isSearchActive ? 'true' : 'false');
        }
        
        // Save category selection
        localStorage.setItem('selected_category', selectedCategory);
      }
    } catch (e) {
      console.error('Error saving search state:', e);
    }
  }, [query, isSearchActive, selectedCategory]);

  // Restore search state on component mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // Restore search query and state
        const savedQuery = localStorage.getItem('search_query') || '';
        const searchActive = localStorage.getItem('search_active') === 'true';
        const savedCategory = localStorage.getItem('selected_category') as CategoryType | null;
        
        if (savedQuery) {
          setQuery(savedQuery);
          setIsSearchActive(searchActive);
          
          // If previously in search mode, re-perform the search
          if (searchActive) {
            performSearch(savedQuery);
          }
        } else {
          // Explicitly set to empty string to avoid any default characters
          setQuery('');
        }
        
        // Restore category selection
        if (savedCategory) {
          setSelectedCategory(savedCategory);
        }
      }
    } catch (e) {
      console.error('Error restoring search state:', e);
    }
  }, []);

  // Function to filter content based on selected category
  const filterContentByCategory = (items: TMDbSearchResult[], category: CategoryType): TMDbSearchResult[] => {
    if (category === 'all') return items;
    
    return items.filter(item => {
      // Ensure media_type is defined - infer from properties if missing
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      
      // If media_type was missing, set it now for consistency
      if (!item.media_type) {
        item.media_type = mediaType;
      }
      
      if (category === 'movies') {
        // For movies, must be movie type AND not animation genre (16) AND preferably English
        const isMovie = mediaType === 'movie';
        const isAnimation = item.genre_ids?.includes(16);
        const isEnglish = (item as any).original_language === 'en';
        
        // Only return non-animated English movies 
        return isMovie && !isAnimation && isEnglish;
      } else if (category === 'tv') {
        // For TV, must be TV type AND not animation genre (16) AND preferably English
        const isTVShow = mediaType === 'tv';
        const isAnimation = item.genre_ids?.includes(16);
        const isEnglish = (item as any).original_language === 'en';
        
        // Only return non-animated English TV shows
        return isTVShow && !isAnimation && isEnglish;
      } else if (category === 'anime') {
        // For anime, be less restrictive to include more content
        // Look for animation in any language, but prioritize Japanese
        const isAnimation = item.genre_ids?.includes(16);
        const isJapanese = (item as any).original_language === 'ja';
        const isAsian = ['ja', 'ko', 'zh'].includes((item as any).original_language);
        
        // Include any animation OR any Japanese/Korean/Chinese content
        return isAnimation || isJapanese || isAsian;
      } else if (category === 'documentaries') {
        // For documentaries, filter by documentary genre_id (99)
        return item.genre_ids?.includes(99);
      }
      
      return false; // Default fallback
    });
  };

  // Fetch initial data on component mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Apply category filtering when selected category changes
  useEffect(() => {
    // Don't re-filter if we're in search mode
    if (isSearchActive && query) {
      performSearch(query);
      return;
    }
    
    // Don't continue if we're still loading initial data
    if (loading) return;
    
    // If we don't have original data yet, fetch it
    if (originalTrendingItems.current.length === 0) {
      fetchInitialData();
      return;
    }
    
    // Use original data stored in refs for filtering
    const filteredTrending = filterContentByCategory(originalTrendingItems.current, selectedCategory);
    setTrendingItems(selectedCategory === 'all' ? 
      originalTrendingItems.current.slice(0, 10) : 
      filteredTrending.slice(0, 10));
    
    // Filter new releases
    const filteredNewReleases = filterContentByCategory(originalNewReleases.current, selectedCategory);
    setNewReleases(filteredNewReleases.slice(0, 10));
    
    // For recommended/highest rated
    if (selectedCategory !== 'all') {
      // For non-all categories, check if we already have the correct category-specific highest rated items
      if (originalHighestRatedItems.current.length > 0) {
        // Re-fetch if the stored items don't match the current category 
        // (this happens when switching between categories)
        const needToFetch = selectedCategory === 'movies' && 
          originalHighestRatedItems.current[0]?.media_type !== 'movie';
            
        const needToFetchTV = selectedCategory === 'tv' && 
          originalHighestRatedItems.current[0]?.media_type !== 'tv';
            
        if (needToFetch || needToFetchTV) {
          // Need to re-fetch data for this category
          fetchInitialData();
          return;
        }
            
        // Apply category filters to highest rated items
        let filteredHighestRated = originalHighestRatedItems.current;
        
        // Filter based on category
        if (selectedCategory === 'movies') {
          // English movies only, no animation
          filteredHighestRated = filteredHighestRated.filter(item => {
            const isEnglish = (item as any).original_language === 'en';
            const isAnimation = item.genre_ids?.includes(16);
            return item.media_type === 'movie' && isEnglish && !isAnimation;
          });
        } else if (selectedCategory === 'tv') {
          // English TV shows only, no animation
          filteredHighestRated = filteredHighestRated.filter(item => {
            const isEnglish = (item as any).original_language === 'en';
            const isAnimation = item.genre_ids?.includes(16);
            return item.media_type === 'tv' && isEnglish && !isAnimation;
          });
        } else if (selectedCategory === 'anime') {
          // Anime filtering
          filteredHighestRated = filteredHighestRated.filter(item => {
            const isAnimation = item.genre_ids?.includes(16);
            const isJapanese = (item as any).original_language === 'ja';
            return isAnimation || (isJapanese && item.genre_ids?.includes(16));
          });
        } else if (selectedCategory === 'documentaries') {
          // Documentary filtering
          filteredHighestRated = filteredHighestRated.filter(item => 
            item.genre_ids?.includes(99)
          );
        }
        
        // Sort by rating
        filteredHighestRated = filteredHighestRated.sort((a, b) => b.vote_average - a.vote_average);
        
        // Use filtered results if we have any, otherwise fetch new data
        if (filteredHighestRated.length > 0) {
          setRecommendedItems(filteredHighestRated.slice(0, 10));
        } else {
          // If filtering removed all items, we need to fetch data
          fetchInitialData();
        }
      } else {
        // If we don't have highest rated items yet, fetch data
        fetchInitialData();
      }
    } else {
      // For "all" category, use the personalized recommendations
      if (originalRecommendedItems.current.length > 0) {
        setRecommendedItems(originalRecommendedItems.current.slice(0, 6));
      } else {
        // If we don't have recommended items yet, fetch data
        fetchInitialData();
      }
    }
  }, [selectedCategory]);

  // Define the fetchInitialData function to fetch initial data
  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Define current year, month, and date threshold for filtering
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      
      // Calculate date threshold for API calls (18 months ago)
      const thresholdDate = new Date(today);
      thresholdDate.setMonth(today.getMonth() - 18);
      const dateThreshold = `${thresholdDate.getFullYear()}-${String(thresholdDate.getMonth() + 1).padStart(2, '0')}-01`;
      
      // Get trending items - Using only weekly trending as specified
      // Using the specific endpoint: https://api.themoviedb.org/3/trending/all/week?language=en-US
      const trendingResponse = await getTrending('week', 'all', 1, 'en-US');
      
      // Create a set of user item IDs for filtering
      const watchlistItems = useWatchlistStore.getState().items || [];
      const watchedItems = useWatchedStore.getState().items || [];
      
      const userItemIds = new Set<number>([
        ...watchlistItems.map((item: WatchlistItem) => item.id),
        ...watchedItems.map((item: WatchedItem) => item.id)
      ]);
      
      // Store trending items for filtering operations
      originalTrendingItems.current = [...trendingResponse.results];
      
      // Apply category filtering
      const filteredTrendingItems = filterContentByCategory(trendingResponse.results, selectedCategory);
      setTrendingItems(selectedCategory === 'all' ? 
        trendingResponse.results.slice(0, 10) : 
        filteredTrendingItems.slice(0, 10));
      
      // Set spotlight item with improved criteria
      const twoYearsAgo = currentYear - 2;
      
      const spotlightCandidates = filteredTrendingItems
        .filter(item => 
          (selectedCategory === 'all' || selectedCategory === 'movies' ? item.media_type === 'movie' : true) && 
          item.backdrop_path && 
          item.vote_average >= 7.0 &&
          item.overview && 
          item.overview.length > 100
        );
      
      // First try to find recent popular movies
      const recentSpotlightCandidates = spotlightCandidates
        .filter(item => {
          const releaseYear = new Date(item.release_date || '').getFullYear();
          return releaseYear >= twoYearsAgo;
        })
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      
      // If we have recent candidates, use the most popular one
      // Otherwise fall back to overall highest rated
      const movieSpotlight = recentSpotlightCandidates.length > 0 
        ? recentSpotlightCandidates[0] 
        : spotlightCandidates.sort((a, b) => b.vote_average - a.vote_average)[0] || null;
      
      if (movieSpotlight) {
        setSpotlightItem(movieSpotlight);
      }
      
      // *****************************************************
      // QUALITY SECTION - IMPLEMENTATION OF HIGHEST RATED CONTENT
      // *****************************************************
      
      // Fetch highest rated movies directly from the top_rated endpoint
      const topRatedMovies = await getTopRated('movie', 1);
      // Make sure each item has media_type set
      topRatedMovies.results.forEach(item => {
        item.media_type = 'movie';
      });
      console.log('Top Rated Movies from endpoint:', topRatedMovies.results[0]); // Debug
      
      // Fetch top rated TV shows directly from the top_rated endpoint
      const topRatedTVShows = await getTopRated('tv', 1);
      // Make sure each item has media_type set
      topRatedTVShows.results.forEach(item => {
        item.media_type = 'tv';
      });
      console.log('Top Rated TV Shows from endpoint:', topRatedTVShows.results[0]); // Debug
      
      // Display "For You" section for "all" category
      if (selectedCategory === 'all') {
        // Get recommendations using trending content instead of personalized recs
        // Using the specific endpoint: https://api.themoviedb.org/3/trending/all/week?language=en-US
        const recommendedResponse = await getTrending('week', 'all', 1, 'en-US');
        
        // *****************************************************
        // FOR YOU SECTION - PERSONALIZED RECOMMENDATIONS EXCLUDING USER LISTS
        // *****************************************************
        
        // Filter out items that are already in the user's watchlist or watched list
        let allRecommendedItems = recommendedResponse.results
          .filter(item => item.id !== movieSpotlight?.id && !userItemIds.has(item.id));
        
        // Extract genres, directors, franchises from user's watched/watchlist items
        // This helps us prioritize content similar to what they enjoy
        const userGenrePreferences = new Map<number, number>();
        
        // Give more weight to watched items (they finished these)
        watchedItems.forEach((item: WatchedItem) => {
          const itemWithGenres = item as unknown as { genre_ids?: number[] };
          (itemWithGenres.genre_ids || []).forEach((genreId: number) => {
            userGenrePreferences.set(genreId, (userGenrePreferences.get(genreId) || 0) + 2);
          });
        });
        
        // Less weight for watchlist items (they're interested but haven't watched)
        watchlistItems.forEach((item: WatchlistItem) => {
          const itemWithGenres = item as unknown as { genre_ids?: number[] };
          (itemWithGenres.genre_ids || []).forEach((genreId: number) => {
            userGenrePreferences.set(genreId, (userGenrePreferences.get(genreId) || 0) + 1);
          });
        });
        
        // Sort by a quality score combining rating, recency, popularity and user preferences
        allRecommendedItems.sort((a, b) => {
          const aReleaseYear = new Date(a.release_date || a.first_air_date || '').getFullYear();
          const bReleaseYear = new Date(b.release_date || b.first_air_date || '').getFullYear();
          
          // Calculate recency bonus (0-3 points)
          const aRecencyBonus = Math.max(0, 3 - (currentYear - aReleaseYear));
          const bRecencyBonus = Math.max(0, 3 - (currentYear - bReleaseYear));
          
          // Calculate user preference score based on genre matches
          let aPreferenceScore = 0;
          let bPreferenceScore = 0;
          
          // Add preference scores based on genre matches
          a.genre_ids?.forEach(genreId => {
            if (userGenrePreferences.has(genreId)) {
              aPreferenceScore += userGenrePreferences.get(genreId) || 0;
            }
          });
          
          b.genre_ids?.forEach(genreId => {
            if (userGenrePreferences.has(genreId)) {
              bPreferenceScore += userGenrePreferences.get(genreId) || 0;
            }
          });
          
          // Give extra boost to items in same franchise/series as watched items
          // Simple implementation: exact title prefix matching
          const aTitleLower = (a.title || a.name || '').toLowerCase();
          const bTitleLower = (b.title || b.name || '').toLowerCase();
          
          watchedItems.forEach((item: WatchedItem) => {
            const itemTitle = (item.title || '').toLowerCase();
            if (itemTitle && aTitleLower.startsWith(itemTitle) || itemTitle.startsWith(aTitleLower)) {
              aPreferenceScore += 3; // Big boost for franchise matches
            }
            if (itemTitle && bTitleLower.startsWith(itemTitle) || itemTitle.startsWith(bTitleLower)) {
              bPreferenceScore += 3;
            }
          });
          
          // Calculate quality score: 
          // rating (0-10) * 2 + recency bonus (0-3) + popularity factor (0-2) + preference bonus
          const aScore = (a.vote_average * 2) + aRecencyBonus + Math.min(2, (a.popularity || 0) / 100) + aPreferenceScore;
          const bScore = (b.vote_average * 2) + bRecencyBonus + Math.min(2, (b.popularity || 0) / 100) + bPreferenceScore;
          
          return bScore - aScore;
        });
        
        // Store for filtering and display
        originalRecommendedItems.current = [...allRecommendedItems];
        setRecommendedItems(allRecommendedItems.slice(0, 6));
      } 
      else {
        // Display "Highest Rated" for specific categories
        let highestRatedItems: TMDbSearchResult[] = [];
        
        // Store for category-specific display without additional filtering
        if (selectedCategory === 'movies') {
          // Ensure media_type is set on all items
          topRatedMovies.results.forEach(item => {
            item.media_type = 'movie';
            (item as any)._source = 'top_rated_movies_endpoint';
          });
          
          // Filter for English language only and no animation
          const englishNonAnimatedMovies = topRatedMovies.results.filter(item => {
            const isEnglish = (item as any).original_language === 'en';
            const isAnimation = item.genre_ids?.includes(16);
            return isEnglish && !isAnimation;
          });
          
          // Directly use the filtered top_rated movies
          highestRatedItems = [...englishNonAnimatedMovies];
          console.log('Using highestRatedItems from movie endpoint (English only):', highestRatedItems[0]); // Debug
        } 
        else if (selectedCategory === 'tv') {
          // Ensure media_type is set on all items
          topRatedTVShows.results.forEach(item => {
            item.media_type = 'tv';
            (item as any)._source = 'top_rated_tv_endpoint'; 
          });
          
          // Get more TV show pages to have more options
          const moreTVShows = await getTopRated('tv', 2);
          moreTVShows.results.forEach(item => {
            item.media_type = 'tv';
          });
          
          // Get even more TV shows from a third page
          const evenMoreTVShows = await getTopRated('tv', 3);
          evenMoreTVShows.results.forEach(item => {
            item.media_type = 'tv';
          });
          
          // Combine all TV shows
          const allTVShows = [
            ...topRatedTVShows.results, 
            ...moreTVShows.results,
            ...evenMoreTVShows.results
          ];
          
          // Filter but make language less restrictive - allow non-English popular shows
          const filteredTVShows = allTVShows.filter(item => {
            const isAnimation = item.genre_ids?.includes(16);
            
            // We're primarily interested in removing animation shows
            // Keep any show regardless of language that has a vote average of 8.5+
            if (item.vote_average >= 8.5) {
              return !isAnimation; // For highly rated shows, only filter out animation
            }
            
            // For regular shows, prefer English but don't require it
            const isEnglish = (item as any).original_language === 'en';
            return !isAnimation && (isEnglish || item.vote_average >= 8.0);
          });
          
          // Sort by rating
          const sortedTVShows = filteredTVShows.sort((a, b) => b.vote_average - a.vote_average);
          
          // Directly use the filtered TV shows
          highestRatedItems = sortedTVShows;
          console.log('Using highestRatedItems from TV endpoint (more pages):', highestRatedItems.length, 'items'); // Debug
        }
        else if (selectedCategory === 'anime') {
          // For anime, we need specialized filtering since there's no direct top_rated anime endpoint
          // Get a larger set of top-rated TV shows and filter them
          const moreTVShows = await getTopRated('tv', 2); // Get page 2 as well for more options
          // Ensure media_type is set for all TV shows
          moreTVShows.results.forEach(item => {
            item.media_type = 'tv';
          });
          
          const animeFiltered = [...topRatedTVShows.results, ...moreTVShows.results]
            .filter(item => {
              // Identify anime as Japanese animation
              const isAnimation = item.genre_ids?.includes(16);
              const isJapanese = (item as any).original_language === 'ja';
              return isAnimation || (isJapanese && item.genre_ids?.includes(16));
            })
            .sort((a, b) => b.vote_average - a.vote_average);
          
          // If we found some anime in top_rated, use that
          if (animeFiltered.length > 0) {
            // Mark the source for debugging
            animeFiltered.forEach(item => {
              item.media_type = 'tv'; // Ensure media_type is set
              (item as any)._source = 'top_rated_anime_filtered';
            });
            highestRatedItems = animeFiltered;
          } else {
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
            animeDiscover.results.forEach(item => {
              item.media_type = 'tv';
              (item as any)._source = 'discover_anime';
            });
            highestRatedItems = animeDiscover.results;
          }
        }
        else if (selectedCategory === 'documentaries') {
          // For documentaries, we need specialized filtering
          // Get more top-rated movies and filter them
          const moreMovies = await getTopRated('movie', 2); // Get page 2 as well
          // Ensure media_type is set
          moreMovies.results.forEach(item => {
            item.media_type = 'movie';
          });
          
          const docsFiltered = [...topRatedMovies.results, ...moreMovies.results]
            .filter(item => item.genre_ids?.includes(99))
            .sort((a, b) => b.vote_average - a.vote_average);
            
          // If we found some documentaries in top_rated, use that
          if (docsFiltered.length > 0) {
            // Mark the source for debugging
            docsFiltered.forEach(item => {
              item.media_type = 'movie'; // Ensure media_type is set
              (item as any)._source = 'top_rated_docs_filtered';
            });
            highestRatedItems = docsFiltered;
          } else {
            // Fallback to discover for documentaries
            const docDiscover = await discoverContent('movie', {
              genreIds: [99],
              sortBy: 'vote_average.desc',
              voteCountGte: 100,
              voteAverageGte: 7.0,
              page: 1
            });
            // Ensure media_type is set for all items
            docDiscover.results.forEach(item => {
              item.media_type = 'movie';
              (item as any)._source = 'discover_docs';
            });
            highestRatedItems = docDiscover.results;
          }
        }
        
        // Filter out any items without media_type
        highestRatedItems = highestRatedItems.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        
        // Store in a dedicated ref for highest rated content to avoid mixing with other data
        originalHighestRatedItems.current = [...highestRatedItems];
        
        // Set for immediate display
        setRecommendedItems(highestRatedItems.slice(0, 10));
      }
      
      // *****************************************************
      // NEW RELEASES SECTION - USE WEEKLY TRENDING PER REQUEST
      // *****************************************************

      // Use weekly trending for new releases instead of original implementation
      // Using the specific endpoint: https://api.themoviedb.org/3/trending/all/week?language=en-US 
      const newReleasesResponse = await getTrending('week', 'all', 1, 'en-US');
      
      // Create a unique set of items to avoid duplicates
      const uniqueNewReleases = new Set();
      const finalNewReleases: TMDbSearchResult[] = [];
      
      // Add movies first - Using the specific endpoint: https://api.themoviedb.org/3/trending/movie/week?language=en-US
      const movieNewReleases = await getTrending('week', 'movie', 1, 'en-US');
      for (const item of movieNewReleases.results) {
        if (!uniqueNewReleases.has(item.id)) {
          uniqueNewReleases.add(item.id);
          item.media_type = 'movie'; // Ensure media type is set
          finalNewReleases.push(item);
        }
      }
      
      // Add TV shows - Using the specific endpoint: https://api.themoviedb.org/3/trending/tv/day?language=en-US
      const tvNewReleases = await getTrending('day', 'tv', 1, 'en-US'); 
      for (const item of tvNewReleases.results) {
        if (!uniqueNewReleases.has(item.id)) {
          uniqueNewReleases.add(item.id);
          item.media_type = 'tv'; // Ensure media type is set
          finalNewReleases.push(item);
        }
      }
      
      // Add any remaining general trending items not already included
      for (const item of newReleasesResponse.results) {
        if (!uniqueNewReleases.has(item.id)) {
          uniqueNewReleases.add(item.id);
          finalNewReleases.push(item);
        }
      }
      
      // Store for filtering
      originalNewReleases.current = [...finalNewReleases];
      
      // Apply category filtering for display
      const filteredNewReleases = filterContentByCategory(finalNewReleases, selectedCategory);
      setNewReleases(filteredNewReleases.slice(0, 10));
      
      /*
       * ************ EXPLANATION OF "FOR YOU" FILTERING ************
       * 
       * The "For You" section implements personalized content recommendations:
       * 
       * 1. Exclusion Filter: 
       *    - First, we exclude any content that's already in the user's watchlist or watched list
       *    - We also exclude the current spotlight item to avoid redundancy
       * 
       * 2. User Preferences Analysis:
       *    - We analyze the user's watchlist and watched history
       *    - For each genre in the user's watched items, we add 2 points (stronger signal)
       *    - For each genre in the user's watchlist items, we add 1 point (interest signal)
       *    - This builds a weighted map of the user's genre preferences
       * 
       * 3. Franchise/Series Matching:
       *    - We boost content that appears to be in the same franchise/series as items the user has watched
       *    - This is done through title prefix matching
       *    - Matching items get a significant boost (+3 points)
       * 
       * 4. Content Scoring Algorithm:
       *    Content is scored using the formula:
       *    Score = (Rating × 2) + Recency Bonus + Popularity Factor + Preference Score
       *    
       *    Where:
       *    - Rating: The content's vote_average (0-10) multiplied by 2
       *    - Recency Bonus: Up to 3 points for newer content (0-3 years old)
       *    - Popularity Factor: Up to 2 points based on popularity
       *    - Preference Score: Points from genre matching and franchise matching
       * 
       * 5. Final Sorting:
       *    - All content is sorted by the calculated score in descending order
       *    - The top results are presented to the user
       * 
       * This creates a personalized recommendation mix that balances:
       * - Content quality (rating)
       * - Freshness (recency)
       * - Popularity (general appeal)
       * - Personal relevance (genre and franchise matching)
       */
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      setError('Failed to load content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setIsSearchActive(false);
        // Clear search state in localStorage when search is emptied
        if (typeof window !== 'undefined') {
          localStorage.setItem('search_query', '');
          localStorage.setItem('search_active', 'false');
        }
        return;
      }

      setSearchLoading(true);
      setIsSearchActive(true);
      try {
        const response = await searchContent(searchQuery);
        
        // Filter results based on selected category
        const filteredResults = filterContentByCategory(response.results, selectedCategory);
        
        // Sort results by popularity if available
        const sortedResults = [...filteredResults].sort((a, b) => {
          return (b.popularity || 0) - (a.popularity || 0);
        });
        
        setSearchResults(sortedResults);
      } catch (error) {
        console.error('Search failed:', error);
        setError('Failed to fetch search results. Please try again.');
      } finally {
        setSearchLoading(false);
      }
    }, 500),
    [selectedCategory]
  );

  const handleButtonAnimation = async (item: TMDbSearchResult, inWatchlist: boolean) => {
    // Perform add to watchlist operation
    const formattedResult = formatSearchResult(item);
    if (formattedResult) {
      const title = formattedResult.title;
      try {
        // Handle the Promise returned by addToWatchlist
        const added = await addToWatchlist(formattedResult);
        
        // Animate button if successfully added
        if (added) {
          console.log(`Added to watchlist: ${title}`);
          showToast(`"${title}" added to watchlist`, 'success');
          
          // For spotlight button, perform improved animations
          if (item.id === spotlightItem?.id) {
            // Smoother animation sequence with easing
            Animated.parallel([
              Animated.sequence([
                Animated.timing(spotlightButtonScale, {
                  toValue: 0.95,
                  duration: 120,
                  useNativeDriver: false, // Set to false for web compatibility
                }),
                Animated.timing(spotlightButtonScale, {
                  toValue: 1.05,
                  duration: 150,
                  useNativeDriver: false,
                }),
                Animated.timing(spotlightButtonScale, {
                  toValue: 1,
                  duration: 180,
                  useNativeDriver: false,
                }),
              ]),
              Animated.timing(spotlightButtonColor, {
                toValue: 1,
                duration: 350, // Slightly longer for a smoother color transition
                useNativeDriver: false,
              }),
              // Remove the rotation animation since we're handling the icon change directly
              // This ensures the check mark displays correctly
            ]).start();
          }
        } else {
          showToast(`"${title}" is already in your watchlist`, 'info');
        }
      } catch (error) {
        console.error('Error adding to watchlist:', error);
        showToast(`Failed to add "${title}" to watchlist`, 'error');
      }
    }
  };

  const handleAddToWatchlist = (result: TMDbSearchResult) => {
    const inWatchlist = isInWatchlist(result.id);
    if (!inWatchlist) {
      // Call the async function, but don't need to await the result here
      handleButtonAnimation(result, false);
    }
  };

  const handleRewatchItem = async (result: TMDbSearchResult) => {
    const formattedResult = formatSearchResult(result);
    if (formattedResult) {
      const title = formattedResult.title;
      
      // Remove from watched list first
      removeFromWatched(result.id);
      
      try {
        // Then add to watchlist, properly awaiting the Promise
        const wasAdded = await addToWatchlist(formattedResult);
        
        if (wasAdded) {
          console.log(`Moved "${title}" from watched to watchlist for rewatching`);
          showToast(`"${title}" moved to watchlist for rewatching`, 'success');
        } else {
          showToast(`"${title}" is already in your watchlist`, 'info');
        }
      } catch (error) {
        console.error('Error moving to watchlist:', error);
        showToast(`Failed to move "${title}" to watchlist`, 'error');
      }
    }
  };

  const renderMediaItem = (item: TMDbSearchResult, size: 'normal' | 'large' | 'wide' = 'normal') => {
    if (item.media_type === 'person') return null;

    // Ensure media_type is always set - default to 'movie' if missing
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    // If item didn't have a media_type, set it now for consistency
    if (!item.media_type) {
      item.media_type = mediaType;
    }

    const inWatchlist = isInWatchlist(item.id);
    const inWatched = isInWatched(item.id);
    const title = item.title || item.name || '';
    const year = new Date(item.release_date || item.first_air_date || '').getFullYear();
    const yearText = !isNaN(year) ? year.toString() : '';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
    const isHighRated = item.vote_average >= 8.0;
    
    // Determine if this is a top rated item being shown in the Highest Rated section
    const isInHighestRatedSection = selectedCategory !== 'all' && 
      originalHighestRatedItems.current.some(highRatedItem => highRatedItem.id === item.id);
    
    // Adjust dimensions based on size
    let itemWidth = ITEM_WIDTH;
    let itemHeight = itemWidth * 1.5; // Default poster ratio (2:3)
    
    if (size === 'wide') {
      // Make trending items 15% smaller than before (2.25 * 0.85 = ~1.91)
      itemWidth = itemWidth * 1.91; 
      // Use backdrop aspect ratio (16:9) for trending cards
      itemHeight = Math.min((itemWidth * 9) / 16, 225);
    } else if (size === 'large') {
      itemWidth = itemWidth * 1.1;
      itemHeight = itemWidth * 1.5;
    }
    
    // If it's a trending card, we want to adopt a cleaner look similar to highest rated cards
    const isTrendingCard = size === 'wide';
    const shouldShowMinimalOverlay = isTrendingCard || isInHighestRatedSection;
    
    return (
      <TouchableOpacity
        style={[
          styles.mediaItem,
          { 
            width: itemWidth, 
            height: itemHeight 
          },
          // Add a subtle gold border for highly rated items in the top rated section
          isInHighestRatedSection && isHighRated && styles.highRatedItemBorder
        ]}
        onPress={() => {
          router.push({
            pathname: '/details/[type]/[id]',
            params: { 
              type: mediaType, 
              id: item.id.toString() 
            }
          });
        }}
        activeOpacity={0.7}
      >
        <Image
          source={{
            uri: size === 'wide' && item.backdrop_path
              // For wide cards (trending), prioritize backdrop images (landscape)
              ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
              // For normal cards, use poster images (portrait)
              : item.poster_path
                ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                : item.backdrop_path
                  ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                  : 'https://via.placeholder.com/342x513?text=No+Image',
          }}
          style={[
            styles.poster,
            { 
              width: itemWidth, 
              height: itemHeight,
              borderRadius: 8 
            }
          ]}
          resizeMode={size === 'wide' ? 'cover' : 'cover'}
        />
        
        {/* Media Type Indicator (Movie/TV) */}
        <View style={styles.mediaTypeIndicator}>
          {mediaType === 'movie' ? 
            <Film size={12} color="#fff" /> : 
            <Tv size={12} color="#fff" />
          }
          <Text style={styles.mediaTypeText}>
            {mediaType === 'movie' ? 'Movie' : 'TV'}
          </Text>
        </View>
        
        {/* For highest rated section, just show rating with star in corner */}
        {isInHighestRatedSection && rating ? (
          <View style={styles.highestRatedBadge}>
            <Star size={9} color="#FFD700" fill="#FFD700" />
            <Text style={styles.highestRatedBadgeText}>{rating}</Text>
          </View>
        ) : isTrendingCard && rating ? (
          // For trending cards, show rating similar to highest rated
          <View style={styles.trendingRatingBadge}>
            <Star size={9} color="#FFD700" fill="#FFD700" />
            <Text style={styles.highestRatedBadgeText}>{rating}</Text>
          </View>
        ) : null}
        
        {/* Media info overlay with fixed height - only for normal cards */}
        {!shouldShowMinimalOverlay && (
          <View style={[styles.mediaItemInfo, { maxHeight: 73 }]}>
            <Text style={styles.mediaItemTitle} numberOfLines={1}>{title}</Text>
            <View style={styles.mediaItemMetaColumn}>
              <Text style={styles.mediaItemYear}>{yearText}</Text>
              {rating ? (
                <View style={styles.mediaItemRating}>
                  <Star size={12} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.mediaItemRatingText}>{rating}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
        
        {/* Trending cards need the title, but in a minimal style */}
        {isTrendingCard && (
          <View style={styles.trendingTitleContainer}>
            <View style={styles.trendingTitleRow}>
              <Text style={styles.trendingTitle} numberOfLines={1}>{title}</Text>
              {rating ? (
                <View style={styles.trendingInlineBadge}>
                  <Star size={9} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.trendingRatingText}>{rating}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
        
        {/* Action button - at top right with increased size (+25%) */}
        {inWatchlist ? (
          <View style={styles.actionButtonAdded}>
            <Check size={15} color="#fff" />
          </View>
        ) : inWatched ? (
          <TouchableOpacity
            style={styles.actionButtonRewatch}
            onPress={() => handleRewatchItem(item)}
            activeOpacity={0.7}
          >
            <Repeat size={15} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleAddToWatchlist(item)}
            activeOpacity={0.7}
          >
            <Plus size={13} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderSearchResults = () => {
    if (searchLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      );
    }
    
    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No results found</Text>
        </View>
      );
    }
    
    return (
      <FlatList
        data={searchResults}
        renderItem={({ item }) => renderMediaItem(item)}
        keyExtractor={(item) => `search-${item.media_type}-${item.id}`}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
      />
    );
  };

  const renderCategories = () => {
    const categories: { id: CategoryType; label: string }[] = [
      { id: 'all', label: 'All' },
      { id: 'movies', label: 'Movies' },
      { id: 'tv', label: 'TV Shows' },
      { id: 'anime', label: 'Anime' },
      { id: 'documentaries', label: 'Documentaries' },
    ];
    
    return (
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoriesContainer, styles.noFlexGrow]}
          style={styles.noFlexGrow}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.categoryButtonActive,
              ]}
              onPress={() => {
                setSelectedCategory(category.id);
                if (isSearchActive && query) {
                  performSearch(query);
                }
              }}
              // Ensure layout doesn't stretch
              onLayout={(event) => {
                // Force component to maintain its natural width
                const { width } = event.nativeEvent.layout;
                if (width > 120) {
                  event.target?.setNativeProps?.({
                    style: { width: 120 }
                  });
                }
              }}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSpotlight = () => {
    if (!spotlightItem) return null;
    
    const inWatchlist = isInWatchlist(spotlightItem.id);
    
    // Interpolate colors for spotlight button
    const buttonBackgroundColor = spotlightButtonColor.interpolate({
      inputRange: [0, 1],
      outputRange: ['#3498db', '#2ecc71']
    });
    
    return (
      <TouchableOpacity 
        style={styles.spotlightContainer}
        onPress={() => {
          router.push({
            pathname: '/details/[type]/[id]',
            params: { 
              type: spotlightItem.media_type,
              id: spotlightItem.id.toString() 
            }
          });
        }}
        activeOpacity={0.8}
      >
        <Image
          source={{
            uri: spotlightItem.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${spotlightItem.backdrop_path}`
              : spotlightItem.poster_path
                ? `https://image.tmdb.org/t/p/w342${spotlightItem.poster_path}`
                : 'https://via.placeholder.com/780x440?text=No+Image',
          }}
          style={styles.spotlightImage}
          resizeMode="cover"
        />
        <View style={styles.spotlightGradient} />
        <View style={styles.spotlightContent}>
          <Text style={styles.spotlightTitle}>{spotlightItem.title || spotlightItem.name}</Text>
          <View style={styles.spotlightMeta}>
            <Text style={styles.spotlightYear}>
              {new Date(spotlightItem.release_date || spotlightItem.first_air_date || '').getFullYear()}
            </Text>
            <Text style={styles.spotlightDot}>•</Text>
            <Text style={styles.spotlightGenre}>
              {spotlightItem.media_type === 'movie' ? 'Action, Adventure, Sci-Fi' : 'Drama, Sci-Fi'}
            </Text>
            <Text style={styles.spotlightDot}>•</Text>
            <View style={styles.spotlightRating}>
              <Star size={14} color="#FFD700" fill="#FFD700" />
              <Text style={styles.spotlightRatingText}>{spotlightItem.vote_average?.toFixed(1)}</Text>
            </View>
          </View>
          <Text style={styles.spotlightOverview} numberOfLines={2}>
            {spotlightItem.overview}
          </Text>
          
          <Animated.View
            style={[
              styles.spotlightButton,
              {
                backgroundColor: inWatchlist ? '#2ecc71' : buttonBackgroundColor,
                transform: [{ scale: spotlightButtonScale }]
              }
            ]}
          >
            <TouchableOpacity
              style={styles.spotlightButtonContent}
              onPress={() => handleAddToWatchlist(spotlightItem)}
              activeOpacity={0.7}
              disabled={inWatchlist}
            >
              {inWatchlist ? (
                <Check size={14} color="#fff" />
              ) : (
                <Plus size={14} color="#fff" />
              )}
              <Text style={styles.spotlightButtonText}>
                {inWatchlist ? 'Added to Watchlist' : 'Add to Watchlist'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHorizontalList = (title: string, items: TMDbSearchResult[]) => {
    if (items.length === 0) return null;
    
    const isTrending = title === 'Trending Now';
    
    // Modify title based on selected category - change "For You" to "Highest Rated" when not in "all"
    let displayTitle = title;
    if (title === 'For You' && selectedCategory !== 'all') {
      displayTitle = 'Highest Rated';
    }
    
    // Display ratings more prominently for Highest Rated items
    const isHighestRated = displayTitle === 'Highest Rated';
    
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{displayTitle}</Text>
          
          <TouchableOpacity 
            onPress={() => {
              // Navigate to appropriate highest rated page if it's the Highest Rated section
              if (isHighestRated) {
                if (selectedCategory === 'movies') {
                  router.push('/search/Highest-Rated/movies' as any);
                } else if (selectedCategory === 'tv') {
                  router.push('/search/Highest-Rated/tv' as any);
                } else if (selectedCategory === 'anime') {
                  router.push('/search/Highest-Rated/anime' as any);
                } else if (selectedCategory === 'documentaries') {
                  router.push('/search/Highest-Rated/documentaries' as any);
                }
              }
              // For other sections we could implement something else later
            }}
          >
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
                
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {items.map((item) => (
            <View 
              key={`${title}-${item.id}`} 
              style={[
                styles.horizontalItem,
                isTrending && styles.horizontalItemWide
              ]}
            >
              {renderMediaItem(item, isTrending ? 'wide' : 'normal')}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Function to set a new spotlight item from available trending items
  const rotateSpotlightItem = () => {
    if (trendingItems.length === 0) return;
    
    // Filter potential spotlight candidates
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;
    
    // Use same criteria as in fetchInitialData
    const spotlightCandidates = trendingItems
      .filter(item => 
        (selectedCategory === 'all' || selectedCategory === 'movies' ? item.media_type === 'movie' : true) && 
        item.backdrop_path && 
        item.vote_average >= 7.0 &&
        item.overview && 
        item.overview.length > 100
      );
      
    if (spotlightCandidates.length === 0) return;
    
    // Get current spotlight ID
    const currentSpotlightId = spotlightItem?.id;
    
    // Find items that weren't recently shown (not in recentSpotlightIds)
    let eligibleItems = spotlightCandidates.filter(item => 
      item.id !== currentSpotlightId && !recentSpotlightIds.has(item.id)
    );
    
    // If we filtered out all items, just use all candidates except current
    if (eligibleItems.length === 0) {
      eligibleItems = spotlightCandidates.filter(item => item.id !== currentSpotlightId);
      
      // If we still have no items, use all candidates
      if (eligibleItems.length === 0) {
        eligibleItems = spotlightCandidates;
      }
      
      // Clear recent history if we're cycling through again
      recentSpotlightIds.clear();
    }
    
    // Sort eligible items by quality score (combining rating and popularity)
    eligibleItems.sort((a, b) => {
      const scoreA = (a.vote_average * 10) + Math.min(20, (a.popularity || 0) / 10);
      const scoreB = (b.vote_average * 10) + Math.min(20, (b.popularity || 0) / 10);
      return scoreB - scoreA;
    });
    
    // Pick from top 3 candidates with a bias toward higher quality
    const topCandidates = eligibleItems.slice(0, Math.min(3, eligibleItems.length));
    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    const newSpotlightItem = topCandidates[randomIndex];
    
    // Set the new spotlight with a fade animation
    if (newSpotlightItem) {
      // Reset button animation values
      spotlightButtonScale.setValue(1);
      spotlightButtonColor.setValue(0);
      
      // Add this item to recently shown
      if (newSpotlightItem.id) {
        recentSpotlightIds.add(newSpotlightItem.id);
        
        // Keep the set size limited to avoid memory issues
        if (recentSpotlightIds.size > 5) {
          // Remove oldest item (first added) - for Sets we need to do this manually
          const iterator = recentSpotlightIds.values();
          const firstItem = iterator.next().value;
          if (firstItem !== undefined) {
            recentSpotlightIds.delete(firstItem);
          }
        }
      }
      
      // Set the new spotlight item
      setSpotlightItem(newSpotlightItem);
      console.log('Rotated spotlight item to:', newSpotlightItem.title || newSpotlightItem.name);
    }
  };

  // Add an effect to rotate the spotlight item periodically
  useEffect(() => {
    // Set initial rotation timer
    const rotationTimer = setInterval(() => {
      // Call rotation function within the interval to ensure we have latest state
      rotateSpotlightItem();
    }, 10 * 60 * 1000); // 10 minutes
    
    // Clean up timer on unmount
    return () => clearInterval(rotationTimer);
  }, []); // Empty dependency array since we're accessing latest state in the interval

  // Fix navigation on refresh by persisting auth state and router path
  // Add a helper to persist login state in useEffect after fetchInitialData
  useEffect(() => {
    // Only run this on client side
    if (typeof window === 'undefined') return;
    
    // Save current path to sessionStorage to help with refresh navigation
    try {
      // Store the current path and tab
      const currentPath = window.location.pathname;
      sessionStorage.setItem('lastPath', currentPath);
      
      // Also set a flag that we're already authenticated
      // This prevents the login flash on refresh
      sessionStorage.setItem('isAuthenticated', 'true');
      
      // Add event listener for beforeunload to ensure we save state before refresh
      const handleBeforeUnload = () => {
        sessionStorage.setItem('lastPath', window.location.pathname);
        sessionStorage.setItem('isAuthenticated', 'true');
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } catch (e) {
      console.error('Error saving navigation state:', e);
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <Search size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies, shows, actors..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            performSearch(text);
          }}
        />
      </View>
      
      {/* Category filters */}
      {renderCategories()}
      
      {isSearchActive ? (
        renderSearchResults()
      ) : (
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Content container with padding to prevent overlap */}
          <View style={styles.contentContainer}>
            {/* Spotlight section - only show when "all" category is selected */}
            {selectedCategory === 'all' && renderSpotlight()}
            
            {/* Trending section */}
            {renderHorizontalList('Trending Now', trendingItems)}
            
            {/* For You section */}
            {renderHorizontalList('For You', recommendedItems)}
            
            {/* New Releases section */}
            {renderHorizontalList('New Releases', newReleases)}
          </View>
        </ScrollView>
      )}
      
      {loading && (
        <View style={styles.fullscreenLoader}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    height: 48,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  categoriesContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignItems: 'flex-start',  // Prevent vertical stretching
    justifyContent: 'flex-start', // Align items to start
  },
  noFlexGrow: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: '#1E1E1E',
    minWidth: 60,
    maxWidth: 120, // Add max width to prevent stretching
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  categoryButtonActive: {
    backgroundColor: '#3498db',
  },
  categoryText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  spotlightContainer: {
    height: 220,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    ...getElevation(5),
  },
  spotlightImage: {
    width: '100%',
    height: '100%',
  },
  spotlightGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  spotlightContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 80,
  },
  spotlightTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  spotlightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  spotlightYear: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  spotlightDot: {
    color: '#ccc',
    fontSize: 14,
    marginHorizontal: 6,
  },
  spotlightGenre: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  spotlightRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotlightRatingText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  spotlightOverview: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 16,
  },
  spotlightButton: {
    backgroundColor: '#3498db',
    borderRadius: 22,
    alignSelf: 'flex-start',
    height: 40,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginTop: 2, // Align better with text flow
  },
  spotlightButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: '100%',
  },
  spotlightButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 16, // Help with vertical alignment of text
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  sectionTitleRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sectionTitleRatingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  seeAllText: {
    color: '#3498db',
    fontSize: 14,
  },
  horizontalList: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  horizontalItem: {
    marginRight: 12,
  },
  horizontalItemWide: {
    marginRight: 12,
    // No specific height - we'll adjust in the renderMediaItem function
  },
  mediaItem: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    margin: 6,
    backgroundColor: '#000',
    ...getElevation(3),
  },
  poster: {
    borderRadius: 8,
  },
  actionButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  actionButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#3498db',
    borderRadius: 15,
    width: 30, // Increased by 25% from 24
    height: 30, // Increased by 25% from 24
    justifyContent: 'center',
    alignItems: 'center',
    ...getElevation(2),
  },
  actionButtonAdded: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#2ecc71',
    borderRadius: 15,
    width: 30, // Increased by 25% from 24
    height: 30, // Increased by 25% from 24
    justifyContent: 'center',
    alignItems: 'center',
    ...getElevation(2),
  },
  actionButtonRewatch: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#f39c12',
    borderRadius: 15,
    width: 30, // Increased by 25% from 24
    height: 30, // Increased by 25% from 24
    justifyContent: 'center',
    alignItems: 'center',
    ...getElevation(2),
  },
  mediaItemInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 10, // Reduced padding for more compact look
    maxHeight: 73, // Max height as requested
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  mediaItemTitle: {
    color: '#fff',
    fontSize: 13, // Slightly smaller to fit in limited space
    fontWeight: '600',
    marginBottom: 3, // Reduced spacing
  },
  mediaItemMetaColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  mediaItemYear: {
    color: '#aaa',
    fontSize: 11, // Smaller for space conservation
    marginBottom: 1, // Reduced spacing
  },
  mediaItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1, // Reduced spacing
  },
  mediaItemRatingText: {
    color: '#FFD700',
    fontSize: 12,
    marginLeft: 4,
  },
  grid: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  fullscreenLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  categoriesWrapper: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
    maxHeight: 56, // Fixed height to prevent overflow
    overflow: 'hidden',
    marginBottom: 8,
  },
  mediaTypeIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  highestRatedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  highestRatedBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  highRatedItemBorder: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  enhancedRating: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  trendingRatingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingTitleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  trendingTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', 
  },
  trendingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trendingInlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  trendingRatingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
});