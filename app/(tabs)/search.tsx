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
  
  // Animation values for button transitions
  const spotlightButtonScale = useRef(new Animated.Value(1)).current;
  const spotlightButtonColor = useRef(new Animated.Value(0)).current;
  const spotlightButtonRotation = useRef(new Animated.Value(0)).current;
  
  const { addItem: addToWatchlist, hasItem: isInWatchlist } = useWatchlistStore();
  const { hasItem: isInWatched, removeItem: removeFromWatched } = useWatchedStore();
  const router = useRouter();

  // Fetch initial data on component mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch trending content
      const trendingResponse = await getTrending('day');
      setTrendingItems(trendingResponse.results.slice(0, 10));
      
      // Set spotlight item - get highest rated movie with backdrop
      const sortedMovies = trendingResponse.results
        .filter(item => item.media_type === 'movie' && item.backdrop_path && item.vote_average >= 7)
        .sort((a, b) => b.vote_average - a.vote_average);
      
      const movieSpotlight = sortedMovies.length > 0 ? sortedMovies[0] : null;
      
      if (movieSpotlight) {
        setSpotlightItem(movieSpotlight);
      }
      
      // Get recommendations (using trending weekly as recommendations)
      const recommendedResponse = await getTrending('week');
      setRecommendedItems(recommendedResponse.results
        .filter(item => item.id !== spotlightItem?.id)
        .slice(0, 6));
      
      // Get new releases (using trending day but filtering to recent releases)
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      const newReleasesFiltered = trendingResponse.results.filter(item => {
        const releaseYear = new Date(item.release_date || item.first_air_date || '').getFullYear();
        return releaseYear === currentYear || releaseYear === lastYear;
      });
      setNewReleases(newReleasesFiltered.slice(0, 10));
      
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
        return;
      }

      setSearchLoading(true);
      setIsSearchActive(true);
      try {
        const response = await searchContent(searchQuery);
        
        // Filter results based on selected category
        let filteredResults = response.results;
        
        if (selectedCategory === 'movies') {
          filteredResults = filteredResults.filter(item => item.media_type === 'movie');
        } else if (selectedCategory === 'tv') {
          filteredResults = filteredResults.filter(item => item.media_type === 'tv');
        }
        // Note: We don't have specific identifiers for anime or documentaries from TMDb API
        // This would require additional API calls or metadata to implement
        
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

  const handleButtonAnimation = (item: TMDbSearchResult, inWatchlist: boolean) => {
    // Perform add to watchlist operation
    const formattedResult = formatSearchResult(item);
    if (formattedResult) {
      const title = formattedResult.title;
      const added = addToWatchlist(formattedResult);
      
      // Animate button if successfully added
      if (added) {
        console.log(`Added to watchlist: ${title}`);
        showToast(`"${title}" added to watchlist`, 'success');
        
        // For spotlight button, perform animations
        if (item.id === spotlightItem?.id) {
          Animated.parallel([
            Animated.sequence([
              Animated.timing(spotlightButtonScale, {
                toValue: 0.9,
                duration: 100,
                useNativeDriver: false, // Set to false for web compatibility
              }),
              Animated.timing(spotlightButtonScale, {
                toValue: 1.05,
                duration: 100,
                useNativeDriver: false,
              }),
              Animated.timing(spotlightButtonScale, {
                toValue: 1,
                duration: 100,
                useNativeDriver: false,
              }),
            ]),
            Animated.timing(spotlightButtonColor, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }),
            Animated.timing(spotlightButtonRotation, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }),
          ]).start();
        }
      } else {
        showToast(`"${title}" is already in your watchlist`, 'info');
      }
    }
  };

  const handleAddToWatchlist = (result: TMDbSearchResult) => {
    const inWatchlist = isInWatchlist(result.id);
    if (!inWatchlist) {
      handleButtonAnimation(result, false);
    }
  };

  const handleRewatchItem = (result: TMDbSearchResult) => {
    const formattedResult = formatSearchResult(result);
    if (formattedResult) {
      const title = formattedResult.title;
      
      // Remove from watched list first
      removeFromWatched(result.id);
      
      // Then add to watchlist
      const added = addToWatchlist(formattedResult);
      
      if (added) {
        console.log(`Moved "${title}" from watched to watchlist for rewatching`);
        showToast(`"${title}" moved to watchlist for rewatching`, 'success');
      } else {
        showToast(`"${title}" is already in your watchlist`, 'info');
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
    
    // Adjust dimensions based on size
    let itemWidth = ITEM_WIDTH;
    let itemHeight = itemWidth * 1.5;
    
    if (size === 'large') {
      itemWidth = ITEM_WIDTH * 1.3;
      itemHeight = itemWidth * 1.5;
    } else if (size === 'wide') {
      itemWidth = ITEM_WIDTH * 1.3;
      itemHeight = itemWidth * 0.6; // Wide aspect ratio
    }

    return (
      <TouchableOpacity
        style={[styles.mediaItem, { width: itemWidth }]}
        onPress={() => {
          router.push({
            pathname: '/details/[type]/[id]',
            params: { 
              type: item.media_type,
              id: item.id.toString() 
            }
          });
        }}
      >
        <View style={styles.mediaBadge}>
          {item.media_type === 'movie' ? (
            <Film size={14} color="#fff" />
          ) : (
            <Tv size={14} color="#fff" />
          )}
        </View>
        
        <Image
          source={{
            uri: size === 'wide' && item.backdrop_path
              ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
              : item.poster_path
                ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                : 'https://via.placeholder.com/342x513?text=No+Poster',
          }}
          style={[styles.poster, { width: itemWidth, height: itemHeight }]}
          resizeMode="cover"
        />
        
        {(size === 'large' || size === 'wide') && (
          <View style={styles.rating}>
            <Star size={12} color="#FFD700" fill="#FFD700" />
            <Text style={styles.ratingText}>{item.vote_average?.toFixed(1)}</Text>
          </View>
        )}
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {title}
          </Text>
          {(size === 'large' || size === 'wide') && yearText && (
            <Text style={styles.yearText}>{yearText}</Text>
          )}
        </View>
        
        {/* Action buttons with animated transition */}
        {inWatchlist ? (
          <View style={[styles.actionButton, styles.addedButton]}>
            <Check size={20} color="#2ecc71" />
          </View>
        ) : inWatched ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.rewatchButton]}
            onPress={() => handleRewatchItem(item)}
          >
            <Repeat size={20} color="#2196F3" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.addButton]}
            onPress={() => handleAddToWatchlist(item)}
            activeOpacity={0.7}
          >
            <Plus size={20} color="#3498db" />
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
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
    
    // Interpolate rotation for icon transition
    const iconRotation = spotlightButtonRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg']
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
              activeOpacity={0.8}
              disabled={inWatchlist}
            >
              <Animated.View style={{ transform: [{ rotate: inWatchlist ? '180deg' : iconRotation }] }}>
                {inWatchlist ? (
                  <Check size={18} color="#fff" />
                ) : (
                  <Plus size={18} color="#fff" />
                )}
              </Animated.View>
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
    
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
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
            <View key={`${title}-${item.id}`} style={styles.horizontalItem}>
              {renderMediaItem(item, title === 'Trending Now' ? 'wide' : 'normal')}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

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
            {/* Spotlight section */}
            {renderSpotlight()}
            
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  categoriesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    zIndex: 2,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#1E1E1E',
  },
  categoryButtonActive: {
    backgroundColor: '#3498db',
  },
  categoryText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  spotlightContainer: {
    height: 220,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    elevation: 8,
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
    // Note: backgroundImage with linear-gradient not supported in React Native
    // Using backgroundColor with opacity instead
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  spotlightContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 60,
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
    height: 44,
    elevation: 3,
  },
  spotlightButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: '100%',
  },
  spotlightButtonIcon: {
    marginRight: 6,
  },
  spotlightButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 6,
  },
  sectionContainer: {
    marginBottom: 24,
    position: 'relative',
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
  mediaItem: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderRadius: 4,
    padding: 4,
    zIndex: 2,
  },
  poster: {
    borderRadius: 8,
  },
  rating: {
    position: 'absolute',
    bottom: 60,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    marginLeft: 2,
  },
  itemInfo: {
    padding: 8,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  yearText: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1,
    elevation: 2,
  },
  addButton: {
    borderWidth: 1.5,
    borderColor: '#3498db',
  },
  addedButton: {
    borderWidth: 1.5,
    borderColor: '#2ecc71',
  },
  rewatchButton: {
    borderWidth: 1.5,
    borderColor: '#2196F3',
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  fullscreenLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
});