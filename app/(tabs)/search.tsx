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
} from 'react-native';
import { useWatchlistStore } from '../../lib/watchlistStore';
import { searchContent, formatSearchResult, TMDbSearchResult, getTrending } from '../../lib/tmdb';
import { Plus, Check, Film, Tv } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { debounce } from 'lodash';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
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

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTrending, setIsTrending] = useState(true);
  const { addItem, hasItem } = useWatchlistStore();
  const router = useRouter();

  // Fetch trending items on initial load
  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrending('day');
      setResults(response.results);
      setPage(1);
      setHasMore(response.page < response.total_pages);
      setIsTrending(true);
    } catch (error) {
      console.error('Failed to fetch trending:', error);
      setError('Failed to fetch trending items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        fetchTrending();
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await searchContent(searchQuery);
        
        // Sort results by popularity if available
        const sortedResults = [...response.results].sort((a, b) => {
          return (b.popularity || 0) - (a.popularity || 0);
        });
        
        setResults(sortedResults);
        setPage(1);
        setHasMore(response.page < response.total_pages);
        setIsTrending(false);
      } catch (error) {
        console.error('Search failed:', error);
        setError('Failed to fetch search results. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const nextPage = page + 1;
      
      let response;
      if (isTrending) {
        response = await getTrending('day', nextPage);
      } else if (query.trim()) {
        response = await searchContent(query, nextPage);
      } else {
        setLoading(false);
        return;
      }
      
      setResults((prev) => [...prev, ...response.results]);
      setPage(nextPage);
      setHasMore(nextPage < response.total_pages);
    } catch (error) {
      console.error('Failed to load more results:', error);
      showToast('Failed to load more results', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = (result: TMDbSearchResult) => {
    const formattedResult = formatSearchResult(result);
    if (formattedResult) {
      const title = formattedResult.title;
      const added = addItem(formattedResult);
      if (added) {
        console.log(`Added to watchlist: ${title}`);
        showToast(`"${title}" added to watchlist`, 'success');
      } else {
        showToast(`"${title}" is already in your watchlist`, 'info');
      }
    }
  };

  const renderItem = ({ item }: { item: TMDbSearchResult }) => {
    if (item.media_type === 'person') return null;

    const isInWatchlist = hasItem(item.id);
    const title = item.title || item.name || '';
    const year = new Date(item.release_date || item.first_air_date || '').getFullYear();
    const yearText = !isNaN(year) ? year.toString() : '';

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => {
          console.log(`Navigating to details: ${item.media_type}/${item.id}`);
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
          style={styles.poster}
          resizeMode="cover"
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.year}>
            {yearText}
          </Text>
          <Text style={styles.rating}>★ {item.vote_average.toFixed(1)}</Text>
        </View>
        {!isInWatchlist ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddToWatchlist(item)}
          >
            <Plus size={20} color="#4CAF50" />
          </TouchableOpacity>
        ) : (
          <View style={styles.addedButton}>
            <Check size={20} color="#4CAF50" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search movies and TV shows..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          performSearch(text);
        }}
      />
      
      {/* Trending header */}
      {isTrending && results.length > 0 && (
        <Text style={styles.trendingHeader}>Trending Today</Text>
      )}
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : loading && results.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.media_type}-${item.id}`}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#4CAF50" />
              </View>
            ) : null
          }
        />
      ) : query.trim() ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No results found</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  trendingHeader: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  list: {
    paddingBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative'
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
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.5,
  },
  itemInfo: {
    padding: 8,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  year: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  rating: {
    color: '#FFD700',
    fontSize: 12,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMore: {
    paddingVertical: 16,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
  },
});