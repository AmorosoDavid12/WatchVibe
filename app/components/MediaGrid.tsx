import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity, Image, Text } from 'react-native';
import { Star, Film, Tv, Plus, Check, Repeat } from 'lucide-react-native';
import { useWatchlistStore } from '../../lib/watchlistStore';
import { useWatchedStore } from '../../lib/watchedStore';
import { formatSearchResult, TMDbSearchResult } from '../../lib/tmdb';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const GRID_COLUMNS = 2;
const SPACING = 12;
const itemWidth = (width - (GRID_COLUMNS + 1) * SPACING) / GRID_COLUMNS;
const itemHeight = itemWidth * 1.5; // Default poster ratio (2:3)

// Local showToast function since there's no shared utility
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  Toast.show({
    type: type,
    text1: message,
    position: 'bottom',
    visibilityTime: 3000,
  });
};

type MediaGridProps = {
  data: TMDbSearchResult[];
  isTrendingSection?: boolean;
};

export default function MediaGrid({ data, isTrendingSection = true }: MediaGridProps) {
  const router = useRouter();
  const { hasItem: isInWatchlist, addItem: addToWatchlist, syncWithSupabase: syncWatchlist } = useWatchlistStore();
  const { hasItem: isInWatched, removeItem: removeFromWatched } = useWatchedStore();
  
  // Add state to force re-renders when watchlist changes
  const [watchlistUpdateKey, setWatchlistUpdateKey] = useState(0);
  
  // Sync watchlist when component mounts to ensure fresh data
  useEffect(() => {
    const doInitialSync = async () => {
      await syncWatchlist();
      // Force a re-render after sync
      setWatchlistUpdateKey(prev => prev + 1);
    };
    
    doInitialSync();
  }, []);

  const handleAddToWatchlist = async (result: TMDbSearchResult) => {
    const formattedResult = formatSearchResult(result);
    if (formattedResult) {
      const inWatchlist = isInWatchlist(result.id);
      if (!inWatchlist) {
        try {
          const added = await addToWatchlist(formattedResult);
          if (added) {
            showToast(`"${formattedResult.title}" added to watchlist`, 'success');
          } else {
            // Item might already exist in database but not in local state
            showToast(`"${formattedResult.title}" is already in your watchlist`, 'info');
          }
          
          // Force re-render to update UI
          setWatchlistUpdateKey(prev => prev + 1);
        } catch (error: any) {
          console.error('Error adding to watchlist:', error);
          showToast(`Failed to add "${formattedResult.title}" to watchlist`, 'error');
        }
      }
    }
  };

  const handleRewatchItem = async (result: TMDbSearchResult) => {
    const formattedResult = formatSearchResult(result);
    if (formattedResult) {
      const title = formattedResult.title;
      
      // Remove from watched list first
      removeFromWatched(result.id);
      
      try {
        // Then add to watchlist
        const wasAdded = await addToWatchlist(formattedResult);
        
        if (wasAdded) {
          showToast(`"${title}" moved to watchlist for rewatching`, 'success');
        } else {
          showToast(`"${title}" is already in your watchlist`, 'info');
        }
        
        // Force re-render to update UI
        setWatchlistUpdateKey(prev => prev + 1);
      } catch (error) {
        console.error('Error moving to watchlist:', error);
        showToast(`Failed to move "${title}" to watchlist`, 'error');
      }
    }
  };

  const renderMediaItem = ({ item }: { item: TMDbSearchResult }) => {
    if (item.media_type === 'person') return null;

    // Ensure media_type is always set - default to 'movie' if missing
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    // If item didn't have a media_type, set it now for consistency
    if (!item.media_type) {
      item.media_type = mediaType;
    }

    // Get current state from the stores - this ensures we always use the latest state
    // Using watchlistUpdateKey as a dependency to trigger re-checks
    const inWatchlist = isInWatchlist(item.id);
    const inWatched = isInWatched(item.id);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
    const isHighRated = item.vote_average >= 8.0;
    
    return (
      <TouchableOpacity
        style={[
          styles.mediaItem,
          // Add gold border for highly rated items
          isHighRated && styles.highRatedItemBorder
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
            uri: item.poster_path
              ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
              : item.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                : 'https://via.placeholder.com/342x513?text=No+Image',
          }}
          style={styles.poster}
          resizeMode="cover"
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
        
        {/* Rating badge in bottom left */}
        {rating ? (
          <View style={styles.ratingBadge}>
            <Star size={9} color="#FFD700" fill="#FFD700" />
            <Text style={styles.ratingBadgeText}>{rating}</Text>
          </View>
        ) : null}
        
        {/* Action button - at top right */}
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

  return (
    <FlatList
      data={data}
      renderItem={renderMediaItem}
      keyExtractor={(item) => `grid-${item.id}-${watchlistUpdateKey}`}
      numColumns={GRID_COLUMNS}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      extraData={watchlistUpdateKey}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: SPACING,
  },
  mediaItem: {
    margin: SPACING / 2,
    width: itemWidth,
    height: itemHeight,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
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
  ratingBadge: {
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
  ratingBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  highRatedItemBorder: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  actionButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonAdded: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonRewatch: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 