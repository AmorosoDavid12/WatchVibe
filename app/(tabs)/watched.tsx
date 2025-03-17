import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  Modal,
  Pressable 
} from 'react-native';
import { useWatchedStore } from '../../lib/watchedStore';
import { useWatchlistStore } from '../../lib/watchlistStore';
import { WatchedItem } from '../../lib/watchedStore';
import { useRouter } from 'expo-router';
import { Star, MoreVertical, Film, Tv } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { getMovieDetails, getTVDetails } from '../../lib/tmdb';

const { width } = Dimensions.get('window');

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

export default function WatchedScreen() {
  const { items, removeItem } = useWatchedStore();
  const { addItem: addToWatchlist } = useWatchlistStore();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WatchedItem | null>(null);
  const [enrichedItems, setEnrichedItems] = useState<(WatchedItem & {
    detailsFetched?: boolean,
    genreNames?: string[]
  })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Make a copy of items to enrich with additional details
    const itemsToEnrich = [...items].map(item => ({ ...item, detailsFetched: false }));
    setEnrichedItems(itemsToEnrich);
    setIsLoading(false);
  }, [items]);

  // Fetch additional details for an item when needed
  const fetchItemDetails = async (item: WatchedItem, index: number) => {
    if (enrichedItems[index].detailsFetched) return;

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
        updated[index] = {
          ...current[index],
          ...details,
          detailsFetched: true,
          genreNames
        };
        return updated;
      });
    } catch (error) {
      console.error('Error fetching details for item:', error);
    }
  };

  const handleRewatch = (item: WatchedItem) => {
    addToWatchlist(item);
    removeItem(item.id);
    showToast(`"${item.title}" moved back to watchlist`);
    setMenuVisible(false);
  };

  const handleRemove = (item: WatchedItem) => {
    removeItem(item.id);
    showToast(`"${item.title}" removed from watched list`);
    setMenuVisible(false);
  };

  const openMenu = (item: WatchedItem) => {
    setSelectedItem(item);
    setMenuVisible(true);
  };

  // Format duration or seasons/episodes info based on media type
  const formatDuration = (item: WatchedItem & { detailsFetched?: boolean }) => {
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
  const formatGenres = (item: WatchedItem & { genreNames?: string[] }) => {
    if (!item.detailsFetched) return '';
    return (item.genreNames || []).slice(0, 2).join(', ');
  };

  const renderItem = ({ item, index }: { item: WatchedItem & { detailsFetched?: boolean, genreNames?: string[] }, index: number }) => {
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
            params: { type: item.media_type, id: item.id.toString() }
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
        <View style={styles.itemDetails}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.title}</Text>
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
            <Text style={styles.ratedText}>Rating: </Text>
            <Star fill="#8c52ff" color="#8c52ff" size={16} />
            <Star fill="#8c52ff" color="#8c52ff" size={16} />
            <Star fill="#8c52ff" color="#8c52ff" size={16} />
            <Star fill="#8c52ff" color="#8c52ff" size={16} />
            <Star stroke="#8c52ff" color="#8c52ff" size={16} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Watched</Text>
      
      {/* Filter buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'All' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('All')}
        >
          <Text style={[styles.filterText, activeFilter === 'All' && styles.activeFilterText]}>All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'Rating' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('Rating')}
        >
          <Text style={[styles.filterText, activeFilter === 'Rating' && styles.activeFilterText]}>Rating</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'Recent' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('Recent')}
        >
          <Text style={[styles.filterText, activeFilter === 'Recent' && styles.activeFilterText]}>Recent</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, activeFilter === 'Genres' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('Genres')}
        >
          <Text style={[styles.filterText, activeFilter === 'Genres' && styles.activeFilterText]}>Genres</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            You haven't watched any movies or TV shows yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={enrichedItems}
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
              onPress={() => selectedItem && handleRewatch(selectedItem)}
            >
              <Text style={styles.menuText}>Rewatch "{selectedItem?.title}"</Text>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => selectedItem && handleRemove(selectedItem)}
            >
              <Text style={styles.menuTextDanger}>Remove from watched list</Text>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8c52ff',
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    backgroundColor: '#2a2a2a',
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#8c52ff',
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
  mediaBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(140, 82, 255, 0.8)',
    borderRadius: 4,
    padding: 4,
    zIndex: 1,
  },
  poster: {
    width: 87,
    height: 130,
  },
  itemDetails: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
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
  ratedText: {
    color: '#999',
    fontSize: 14,
    marginRight: 4,
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
});