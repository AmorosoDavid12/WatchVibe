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
import { useWatchlistStore } from '../../lib/watchlistStore';
import { searchContent, formatSearchResult, TMDbSearchResult, getTrending, getMovieDetails } from '../../lib/tmdb';
import { Plus, Check, Film, Tv, Repeat, Search, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { debounce } from 'lodash';
import Toast from 'react-native-toast-message';
import { useWatchedStore } from '@/lib/watchedStore';

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
    
    if (category === 'movies') {
      return items.filter(item => item.media_type === 'movie');
    } else if (category === 'tv') {
      return items.filter(item => item.media_type === 'tv');
    } else if (category === 'anime') {
      // For anime, look for animation genre_ids (16) in movies/tv shows
      // or Japanese origin content with animation
      return items.filter(item => {
        const isAnimation = item.genre_ids?.includes(16);
        const isJapanese = (item as any).original_language === 'ja';
        return isAnimation || (isJapanese && item.genre_ids?.includes(16));
      });
    } else if (category === 'documentaries') {
      // For documentaries, filter by documentary genre_id (99)
      return items.filter(item => item.genre_ids?.includes(99));
    }
    
    return items; // Default fallback
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
    
    // For the recommended/highest rated section
    if (selectedCategory === 'all') {
      // When in "all" category, use personalized "For You" recommendations
      const filteredRecommended = filterContentByCategory(originalRecommendedItems.current, selectedCategory);
      setRecommendedItems(filteredRecommended.slice(0, 6));
    } else {
      // For other categories, create a "Highest Rated" list
      const filteredItems = filterContentByCategory(originalTrendingItems.current, selectedCategory);
      
      // Sort purely by rating for highest rated section
      const sortedByRating = [...filteredItems].sort((a, b) => b.vote_average - a.vote_average);
      
      // Get top 5 highest rated overall
      const topRated = sortedByRating.slice(0, 5);
      
      // Get highest rated recent items (last 3 years)
      const currentYear = new Date().getFullYear();
      const recentHighRated = sortedByRating
        .filter(item => {
          const releaseYear = new Date(item.release_date || item.first_air_date || '').getFullYear();
          return releaseYear >= currentYear - 3 && !topRated.some(tr => tr.id === item.id);
        })
        .slice(0, 10);
      
      // Combine them
      const highestRatedItems = [...topRated, ...recentHighRated];
      setRecommendedItems(highestRatedItems.slice(0, Math.min(highestRatedItems.length, 6)));
    }
    
    // Filter new releases from original data
    const filteredNewReleases = filterContentByCategory(originalNewReleases.current, selectedCategory);
    setNewReleases(selectedCategory === 'all' ? 
      originalNewReleases.current.slice(0, 10) : 
      filteredNewReleases.slice(0, 10));
    
    // Update spotlight if needed based on new filtered items
    if (filteredTrending.length > 0 && (
      selectedCategory === 'all' || 
      (selectedCategory === 'movies' && spotlightItem?.media_type === 'movie') ||
      (selectedCategory === 'tv' && spotlightItem?.media_type === 'tv')
    )) {
      // The spotlight is still valid for this category, no need to change
    } else {
      // Need to find a new spotlight item from filtered trending items
      const spotlightCandidates = filteredTrending.filter(item => 
        item.backdrop_path && 
        item.vote_average >= 7.0 &&
        item.overview && 
        item.overview.length > 100
      );
      
      if (spotlightCandidates.length > 0) {
        // Pick a random good candidate
        const randomIndex = Math.floor(Math.random() * Math.min(3, spotlightCandidates.length));
        setSpotlightItem(spotlightCandidates[randomIndex]);
      } else {
        // If no suitable spotlight candidate is found, set spotlight to null
        setSpotlightItem(null);
      }
    }
  }, [selectedCategory]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Skip fetching if we're restoring search state
      if (isSearchActive && query) {
        setLoading(false);
        return;
      }
      
      // Fetch trending content
      const trendingResponse = await getTrending('day');
      let allTrendingItems = trendingResponse.results;
      
      // Get additional content for anime and documentaries since they're less common in trending
      // Fetch more content for anime (animation genre)
      let animeItems: TMDbSearchResult[] = [];
      let documentaryItems: TMDbSearchResult[] = [];
      
      try {
        // Get animation content (genre_id 16 for animation)
        const animeResponse = await searchContent('anime animation');
        animeItems = animeResponse.results.filter(item => 
          item.genre_ids?.includes(16) || 
          (item as any).original_language === 'ja'
        );
        
        // Get documentary content (genre_id 99 for documentaries)
        const documentaryResponse = await searchContent('documentary');
        documentaryItems = documentaryResponse.results.filter(item => 
          item.genre_ids?.includes(99)
        );
        
        // Add these items to our trending items pool
        allTrendingItems = [
          ...allTrendingItems,
          ...animeItems.filter(item => !allTrendingItems.some(ti => ti.id === item.id)),
          ...documentaryItems.filter(item => !allTrendingItems.some(ti => ti.id === item.id))
        ];
      } catch (error) {
        console.error('Error fetching specialized content:', error);
        // Continue with existing trending items if this fails
      }
      
      // Store the original trending items for later filtering
      originalTrendingItems.current = [...allTrendingItems];
      
      // Apply category filtering to trending items
      let filteredTrendingItems = filterContentByCategory(allTrendingItems, selectedCategory);
      setTrendingItems(selectedCategory === 'all' ? 
        originalTrendingItems.current.slice(0, 10) : 
        filteredTrendingItems.slice(0, 10));
      
      // Set spotlight item with improved criteria:
      // 1. Must be a movie with a backdrop
      // 2. Must have rating >= 7.0
      // 3. Must have overview text
      // 4. Prefer newer releases (last 2 years)
      // 5. Sort by popularity and vote_average
      
      const currentYear = new Date().getFullYear();
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
        
        // Get recommendations (using trending weekly as recommendations)
        const recommendedResponse = await getTrending('week');
        const allRecommendedItems = recommendedResponse.results
          .filter(item => item.id !== movieSpotlight?.id);
        
        // Get user preferences from watchlist and watched items
        const watchlistItems = useWatchlistStore.getState().items;
        const watchedItems = useWatchedStore.getState().items;
        
        // Extract genres, directors, franchises from user's watched/watchlist items
        // This helps us prioritize content similar to what they enjoy
        const userGenrePreferences = new Map<number, number>();
        
        // Give more weight to watched items (they finished these)
        watchedItems.forEach((item: any) => {
          (item.genre_ids as number[] || []).forEach((genreId: number) => {
            userGenrePreferences.set(genreId, (userGenrePreferences.get(genreId) || 0) + 2);
          });
        });
        
        // Less weight for watchlist items (they're interested but haven't watched)
        watchlistItems.forEach((item: any) => {
          (item.genre_ids as number[] || []).forEach((genreId: number) => {
            userGenrePreferences.set(genreId, (userGenrePreferences.get(genreId) || 0) + 1);
          });
        });
        
        // Add more specialized recommendations based on higher quality scores
        // For better "For You" recommendations, prioritize:
        // 1. Higher rated content (vote_average >= 7.5)
        // 2. More recent releases (last 3 years)
        // 3. Popular but not necessarily trending items
        // 4. Content with genres matching user preferences
        
        // Sort by a quality score combining rating, recency, popularity and user preferences
        allRecommendedItems.sort((a, b) => {
          const aReleaseYear = new Date(a.release_date || a.first_air_date || '').getFullYear();
          const bReleaseYear = new Date(b.release_date || b.first_air_date || '').getFullYear();
          const currentYear = new Date().getFullYear();
          
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
          
          watchedItems.forEach((item: any) => {
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
        
        // Store original recommended items
        originalRecommendedItems.current = [...allRecommendedItems];
        
        // For non-all categories, we'll need a "Highest Rated" list instead of "For You"
        // Create a separate highest rated list for each category
        let highestRatedItems: TMDbSearchResult[] = [];
        
        if (selectedCategory !== 'all') {
          // For highest rated, we want:
          // 1. Top 5 highest rated overall (regardless of year)
          // 2. Then highest rated from the last 3 years
          const filteredItems = filterContentByCategory(allRecommendedItems, selectedCategory);
          
          // Sort purely by rating for highest rated section
          const sortedByRating = [...filteredItems].sort((a, b) => b.vote_average - a.vote_average);
          
          // Get top 5 highest rated overall
          const topRated = sortedByRating.slice(0, 5);
          
          // Get highest rated recent items (last 3 years)
          const currentYear = new Date().getFullYear();
          const recentHighRated = sortedByRating
            .filter(item => {
              const releaseYear = new Date(item.release_date || item.first_air_date || '').getFullYear();
              return releaseYear >= currentYear - 3 && !topRated.some(tr => tr.id === item.id);
            })
            .slice(0, 10);
          
          // Combine them
          highestRatedItems = [...topRated, ...recentHighRated];
          
          // Keep this for filtering operations later
          originalRecommendedItems.current = [...highestRatedItems];
        }
        
        // Filter recommended items based on selected category
        const filteredRecommendedItems = selectedCategory === 'all'
          ? filterContentByCategory(allRecommendedItems, selectedCategory)
          : highestRatedItems;
        
        setRecommendedItems(selectedCategory === 'all' ? 
          allRecommendedItems.slice(0, 6) : 
          filteredRecommendedItems.slice(0, Math.min(filteredRecommendedItems.length, 6)));
        
        // Get new releases (using trending day but filtering to recent releases)
        const allNewReleasesItems = trendingResponse.results.filter(item => {
          const releaseYear = new Date(item.release_date || item.first_air_date || '').getFullYear();
          return releaseYear === currentYear || releaseYear === currentYear - 1;
        });
        
        // Store original new releases
        originalNewReleases.current = [...allNewReleasesItems];
        
        // Filter new releases based on selected category
        const filteredNewReleasesItems = filterContentByCategory(allNewReleasesItems, selectedCategory);
        setNewReleases(selectedCategory === 'all' ? 
          allNewReleasesItems.slice(0, 10) : 
          filteredNewReleasesItems.slice(0, 10));
        
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

    const inWatchlist = isInWatchlist(item.id);
    const inWatched = isInWatched(item.id);
    const title = item.title || item.name || '';
    const year = new Date(item.release_date || item.first_air_date || '').getFullYear();
    const yearText = !isNaN(year) ? year.toString() : '';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
    
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
    
    return (
      <TouchableOpacity
        style={[
          styles.mediaItem,
          { 
            width: itemWidth, 
            height: itemHeight 
          }
        ]}
        onPress={() => {
          router.push({
            pathname: '/details/[type]/[id]',
            params: { 
              type: item.media_type || 'movie', 
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
        {item.id !== spotlightItem?.id && (
          <View style={styles.mediaTypeIndicator}>
            {item.media_type === 'movie' ? 
              <Film size={12} color="#fff" /> : 
              <Tv size={12} color="#fff" />
            }
            <Text style={styles.mediaTypeText}>
              {item.media_type === 'movie' ? 'Movie' : 'TV'}
            </Text>
          </View>
        )}
        
        {/* Media info overlay with fixed height */}
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
            <Plus size={10} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderSearchResults = () => {
    if (searchLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
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
    
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{displayTitle}</Text>
          <TouchableOpacity>
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
          <ActivityIndicator size="large" color="#4CAF50" />
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
});