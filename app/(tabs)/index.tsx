import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Modal,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { useWatchlistStore } from '../../lib/watchlistStore';
import { useWatchedStore } from '../../lib/watchedStore';
import { WatchlistItem } from '../../lib/watchlistStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, MoreVertical, Star, Film, Tv } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { getMovieDetails, getTVDetails } from '../../lib/tmdb';

// Create extended interfaces for enriched items
interface EnrichedItem extends WatchlistItem {
  detailsFetched?: boolean;
  genreNames?: string[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

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

export default function WatchlistScreen() {
  const { items, removeItem, isLoading: storeLoading, isInitialized, syncWithSupabase, addItem } = useWatchlistStore();
  const { addItem: addToWatched } = useWatchedStore();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WatchlistItem | null>(null);
  const [enrichedItems, setEnrichedItems] = useState<EnrichedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(0);

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      await syncWithSupabase();
    };
    
    loadData();
  }, [syncWithSupabase]);

  // Sync with Supabase when the tab is focused
  useFocusEffect(
    useCallback(() => {
      const syncData = async () => {
        await syncWithSupabase();
        setLastSyncTime(Date.now());
      };
      
      // Always sync when tab is focused for server-first approach
      syncData();
      
      return () => {
        // Cleanup if needed when unfocusing
      };
    }, [syncWithSupabase])
  );

  useEffect(() => {
    if (!isInitialized) return;
    
    // Make a copy of items to enrich with additional details
    const itemsToEnrich = [...items].map(item => ({ ...item, detailsFetched: false }));
    setEnrichedItems(itemsToEnrich);
    setIsLoading(false);
  }, [items, isInitialized]);

  // Get filtered items based on active filter
  const getFilteredItems = () => {
    if (activeFilter === 'All') return enrichedItems;
    if (activeFilter === 'Movies') return enrichedItems.filter(item => item.media_type === 'movie');
    if (activeFilter === 'TV Shows') return enrichedItems.filter(item => item.media_type === 'tv');
    return enrichedItems;
  };

  // Fetch additional details for an item when needed
  const fetchItemDetails = async (item: WatchlistItem, index: number) => {
    if (enrichedItems[index]?.detailsFetched) return;

    try {
      let details;
      if (item.media_type === 'movie') {
        details = await getMovieDetails(item.id);
      } else {
        details = await getTVDetails(item.id);
      }

      // Create genre names array from the genres object
      const genreNames = details.genres?.map(genre => genre.name) || [];

      setEnrichedItems(current => {
        const updated = [...current];
        if (updated[index]) {
          updated[index] = {
            ...current[index],
            ...details,
            detailsFetched: true,
            genreNames
          };
        }
        return updated;
      });
    } catch (error) {
      console.error('Error fetching details for item:', error);
    }
  };

  const handleRemove = async (item: WatchlistItem) => {
    const success = await removeItem(item.id);
    if (success) {
      showToast(`"${item.title}" removed from watchlist`);
    } else {
      showToast(`Failed to remove "${item.title}"`, 'error');
    }
    setMenuVisible(false);
  };

  const handleMarkWatched = async (item: WatchlistItem) => {
    const success = await addToWatched(item);
    
    if (success) {
      await removeItem(item.id);
      showToast(`"${item.title}" marked as watched`);
    } else {
      showToast(`Failed to mark "${item.title}" as watched`, 'error');
    }
    
    setMenuVisible(false);
  };

  const openMenu = (item: WatchlistItem) => {
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const navigateToSearch = () => {
    router.push('/search');
  };

  // Format duration or seasons/episodes info based on media type
  const formatDuration = (item: EnrichedItem) => {
    if (!item.detailsFetched) return 'Loading...';

    if (item.media_type === 'movie' && item.runtime) {
      return `${item.runtime} min`;
    } else if (item.media_type === 'tv') {
      const seasons = item.number_of_seasons || 0;
      const episodes = item.number_of_episodes || 0;
      return `${seasons} season${seasons !== 1 ? 's' : ''}, ${episodes} episode${episodes !== 1 ? 's' : ''}`;
    }
    return '';
  };

  // Format genres as a comma-separated string
  const formatGenres = (item: EnrichedItem) => {
    if (!item.detailsFetched) return '';
    return (item.genreNames || []).slice(0, 2).join(', ');
  };

  const renderItem = ({ item, index }: { item: EnrichedItem, index: number }) => {
    // Fetch details when rendering if not already fetched
    if (!item.detailsFetched) {
      fetchItemDetails(item, index);
    }

    return (
      <TouchableOpacity
        style={styles.itemContainer}
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
          style={styles.poster}
          resizeMode="cover"
        />
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => openMenu(item)}
            >
              <MoreVertical size={20} color="#ccc" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.itemMeta}>
            {new Date(item.release_date).getFullYear()} • {formatGenres(item)} • {formatDuration(item)}
          </Text>
          
          <View style={styles.ratingContainer}>
            <Star size={16} color="#FFD700" fill="#FFD700" />
            <Text style={styles.rating}> {item.vote_average.toFixed(1)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading indicator while initializing
  if (storeLoading || isLoading || !isInitialized) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#e21f70" />
        <Text style={styles.loadingText}>Loading watchlist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>VibeWatch</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={navigateToSearch}
        >
          <Plus size={24} color="#ff6b6b" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'All' && styles.activeFilter]}
          onPress={() => setActiveFilter('All')}
        >
          <Text style={[styles.filterText, activeFilter === 'All' && styles.activeFilterText]}>All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'Movies' && styles.activeFilter]}
          onPress={() => setActiveFilter('Movies')}
        >
          <Text style={[styles.filterText, activeFilter === 'Movies' && styles.activeFilterText]}>Movies</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'TV Shows' && styles.activeFilter]}
          onPress={() => setActiveFilter('TV Shows')}
        >
          <Text style={[styles.filterText, activeFilter === 'TV Shows' && styles.activeFilterText]}>TV Shows</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'Genres' && styles.activeFilter]}
          onPress={() => setActiveFilter('Genres')}
        >
          <Text style={[styles.filterText, activeFilter === 'Genres' && styles.activeFilterText]}>Genres</Text>
        </TouchableOpacity>
      </View>

      {/* Empty state or filtered list */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Your watchlist is empty. Add some movies or TV shows!
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={navigateToSearch}
          >
            <Text style={styles.emptyStateButtonText}>Browse Content</Text>
          </TouchableOpacity>
        </View>
      ) : getFilteredItems().length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No {activeFilter !== 'All' ? activeFilter : 'items'} in your watchlist.
          </Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredItems()}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.media_type}-${item.id}`}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Menu Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => selectedItem && handleMarkWatched(selectedItem)}
            >
              <Text style={styles.menuText}>Mark as Watched</Text>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => selectedItem && handleRemove(selectedItem)}
            >
              <Text style={styles.menuTextDanger}>Remove from Watchlist</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6b6b',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    marginRight: 8,
    backgroundColor: '#2a2a2a',
  },
  activeFilter: {
    backgroundColor: '#ff6b6b',
  },
  filterText: {
    color: '#fff',
  },
  activeFilterText: {
    fontWeight: 'bold',
  },
  list: {
    paddingBottom: 16,
  },
  itemContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    flexDirection: 'row',
    height: 130,
    position: 'relative',
  },
  poster: {
    width: 87,
    height: 130,
  },
  mediaBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.8)',
    borderRadius: 4,
    padding: 4,
    zIndex: 1,
  },
  itemContent: {
    flex: 1,
    padding: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    flex: 1,
  },
  menuButton: {
    padding: 2,
  },
  itemMeta: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    color: '#FFD700',
    fontSize: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    width: 250,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  menuTextDanger: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#333',
  },
  centerContent: {
    justifyContent: 'center', 
    alignItems: 'center'
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  emptyStateButton: {
    marginTop: 16,
    backgroundColor: '#e21f70',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});