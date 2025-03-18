import { useState, useCallback, useEffect } from 'react';
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
      
      // Set spotlight item - for now using the first trending item that's a movie
      const movieSpotlight = trendingResponse.results.find(item => 
        item.media_type === 'movie' && item.poster_path && item.backdrop_path
      );
      
      if (movieSpotlight) {
        // For demo purposes, overriding with Dune Part Two info
        setSpotlightItem({
          ...movieSpotlight,
          title: "Dune: Part Two",
          id: 693134, // Dune Part Two ID
          vote_average: 8.6,
          release_date: "2024-03-01",
          media_type: "movie",
          overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family."
        });
      }
      
      // Get recommendations (for this demo, we'll use trending weekly as recommendations)
      const recommendedResponse = await getTrending('week');
      setRecommendedItems(recommendedResponse.results
        .filter(item => item.id !== spotlightItem?.id)
        .slice(0, 6));
      
      // Get new releases (for demo, we're using trending day but filtering to recent releases)
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

  const handleAddToWatchlist = (result: TMDbSearchResult) => {
    const formattedResult = formatSearchResult(result);
    if (formattedResult) {
      const title = formattedResult.title;
      const added = addToWatchlist(formattedResult);
      if (added) {
        console.log(`Added to watchlist: ${title}`);
        showToast(`"${title}" added to watchlist`, 'success');
      } else {
        showToast(`"${title}" is already in your watchlist`, 'info');
      }
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

  const renderMediaItem = (item: TMDbSearchResult, size: 'normal' | 'large' = 'normal') => {
    if (item.media_type === 'person') return null;

    const inWatchlist = isInWatchlist(item.id);
    const inWatched = isInWatched(item.id);
    const title = item.title || item.name || '';
    const year = new Date(item.release_date || item.first_air_date || '').getFullYear();
    const yearText = !isNaN(year) ? year.toString() : '';
    
    const itemWidth = size === 'large' ? ITEM_WIDTH * 1.3 : ITEM_WIDTH;
    const itemHeight = itemWidth * 1.5;

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
            uri: item.poster_path
              ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
              : 'https://via.placeholder.com/342x513?text=No+Poster',
          }}
          style={[styles.poster, { width: itemWidth, height: itemHeight }]}
          resizeMode="cover"
        />
        
        {size === 'large' && (
          <View style={styles.rating}>
            <Star size={12} color="#FFD700" fill="#FFD700" />
            <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
          </View>
        )}
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {title}
          </Text>
          {size === 'large' && yearText && (
            <Text style={styles.yearText}>{yearText}</Text>
          )}
        </View>
        
        {/* Action buttons - three states: Add to watchlist, Already added, or Rewatch */}
        {inWatchlist ? (
          <View style={styles.addedButton}>
            <Check size={20} color="#4CAF50" />
          </View>
        ) : inWatched ? (
          <TouchableOpacity
            style={styles.rewatchButton}
            onPress={() => handleRewatchItem(item)}
          >
            <Repeat size={20} color="#2196F3" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddToWatchlist(item)}
          >
            <Plus size={20} color="#4CAF50" />
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
              <Star size={12} color="#FFD700" fill="#FFD700" />
              <Text style={styles.spotlightRatingText}>{spotlightItem.vote_average?.toFixed(1)}</Text>
            </View>
          </View>
          <Text style={styles.spotlightOverview} numberOfLines={3}>
            {spotlightItem.overview}
          </Text>
          <TouchableOpacity 
            style={styles.spotlightButton}
            onPress={() => handleAddToWatchlist(spotlightItem)}
          >
            <Text style={styles.spotlightButtonText}>Add to Watchlist</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHorizontalList = (title: string, items: TMDbSearchResult[], tag?: string) => {
    if (items.length === 0) return null;
    
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {tag && (
          <View style={styles.tagContainer}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        )}
        
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {items.map((item) => (
            <View key={`${title}-${item.id}`} style={styles.horizontalItem}>
              {renderMediaItem(item, title === 'Trending Now' ? 'large' : 'normal')}
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
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Spotlight section */}
          {renderSpotlight()}
          
          {/* Trending section */}
          {renderHorizontalList('Trending Now', trendingItems, 'HOT')}
          
          {/* For You section */}
          {renderHorizontalList('For You', recommendedItems, 'NEW')}
          
          {/* New Releases section */}
          {renderHorizontalList('New Releases', newReleases, 'NEW')}
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
  categoriesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: '#1E1E1E',
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
    height: 260,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
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
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0))',
  },
  spotlightContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  spotlightTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
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
  },
  spotlightDot: {
    color: '#ccc',
    fontSize: 14,
    marginHorizontal: 6,
  },
  spotlightGenre: {
    color: '#ccc',
    fontSize: 14,
  },
  spotlightRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotlightRatingText: {
    color: '#FFD700',
    fontSize: 14,
    marginLeft: 2,
  },
  spotlightOverview: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 12,
  },
  spotlightButton: {
    backgroundColor: '#2196F3',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  spotlightButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
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
    color: '#4CAF50',
    fontSize: 14,
  },
  tagContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    backgroundColor: '#E53935',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  addButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  addedButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  rewatchButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
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