import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar 
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useWatchlistStore } from '../../../lib/watchlistStore';
import { useWatchedStore } from '../../../lib/watchedStore';
import { ArrowLeft, Plus, Check, Eye, RefreshCw } from 'lucide-react-native';
import { searchContent, formatSearchResult } from '../../../lib/tmdb';
import Toast from 'react-native-toast-message';

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

export default function DetailsScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const itemId = parseInt(id);
  const [fetchedDetails, setFetchedDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const navigation = useNavigation();
  
  // Get stores
  const { items: watchlistItems, addItem: addToWatchlist, removeItem: removeFromWatchlist, hasItem: isInWatchlist } = useWatchlistStore();
  const { items: watchedItems, addItem: addToWatched, removeItem: removeFromWatched, hasItem: isInWatched } = useWatchedStore();
  
  // Find the item in watchlist or watched list
  const watchlistItem = watchlistItems.find(i => i.id === itemId);
  const watchedItem = watchedItems.find(i => i.id === itemId);
  
  // Get the item from any source - watchlist, watched, or fetched details
  const item = watchlistItem || watchedItem || fetchedDetails;

  // Fetch details if not in any list
  useEffect(() => {
    const fetchDetails = async () => {
      if (!watchlistItem && !watchedItem) {
        setLoading(true);
        try {
          // Fetch the details directly using the item ID and type
          const response = await searchContent('', 1, type, itemId);
          
          if (response.results && response.results.length > 0) {
            const found = response.results[0]; // Should be the specific item we requested
            
            if (found) {
              const formatted = formatSearchResult(found);
              if (formatted) {
                setFetchedDetails(formatted);
              } else {
                setError('Could not format item details');
              }
            } else {
              setError('Item not found');
            }
          } else {
            setError('No results found');
          }
        } catch (error) {
          console.error('Failed to fetch details:', error);
          setError('Failed to load details');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    fetchDetails();
  }, [id, type]);

  // Handle adding to watchlist
  const handleAddToWatchlist = () => {
    if (!item) return;
    
    // If in watched list, move to watchlist
    if (isInWatched(itemId)) {
      removeFromWatched(itemId);
      showToast(`"${item.title}" moved from watched to watchlist`);
    } else {
      const added = addToWatchlist(item);
      if (added) {
        showToast(`"${item.title}" added to watchlist`);
      }
    }
  };
  
  // Handle marking as watched
  const handleMarkAsWatched = () => {
    if (!item) return;
    
    // If in watchlist, remove from there
    if (isInWatchlist(itemId)) {
      removeFromWatchlist(itemId);
    }
    
    const added = addToWatched(item);
    if (added) {
      showToast(`"${item.title}" marked as watched`);
    }
  };
  
  // Handle removing from watchlist
  const handleRemoveFromWatchlist = () => {
    if (!item) return;
    
    removeFromWatchlist(itemId);
    showToast(`"${item.title}" removed from watchlist`);
    
    // Make sure we keep the item details available after removing from watchlist
    if (!fetchedDetails) {
      setFetchedDetails(item);
    }
  };
  
  // Handle moving back to watchlist (rewatch)
  const handleRewatch = () => {
    if (!item) return;
    
    removeFromWatched(itemId);
    addToWatchlist(item);
    showToast(`"${item.title}" moved to watchlist for rewatching`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }
  
  if (error || !item) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButtonError} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Item not found'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Top Image with overlay */}
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: item.poster_path
              ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
              : 'https://via.placeholder.com/780x1170?text=No+Poster',
          }}
          style={styles.poster}
          resizeMode="cover"
        />
        
        {/* Transparent top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.actionButtons}>
            {isInWatched(itemId) ? (
              <TouchableOpacity style={styles.actionButton} onPress={handleRewatch}>
                <RefreshCw size={24} color="#4CAF50" />
              </TouchableOpacity>
            ) : (
              <>
                {isInWatchlist(itemId) ? (
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={handleRemoveFromWatchlist}
                  >
                    <Check size={24} color="#4CAF50" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.actionButton} onPress={handleAddToWatchlist}>
                    <Plus size={24} color="#4CAF50" />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.actionButton} onPress={handleMarkAsWatched}>
                  <Eye size={24} color="#2196F3" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        
        {/* Gradient overlay for better text visibility */}
        <View style={styles.gradient} />
      </View>
      
      {/* Content */}
      <ScrollView style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.year}>
          {new Date(item.release_date).getFullYear()}
        </Text>
        <Text style={styles.rating}>★ {item.vote_average.toFixed(1)}</Text>
        
        {/* Add more details here as needed */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  imageContainer: {
    position: 'relative',
    height: 500,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonError: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  year: {
    fontSize: 16,
    color: '#999',
    marginBottom: 4,
  },
  rating: {
    fontSize: 16,
    color: '#FFD700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
}); 