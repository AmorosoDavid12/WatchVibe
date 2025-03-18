import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';

export interface WatchlistItem {
  id: number;
  title: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv' | 'person';
  release_date: string;
  vote_average: number;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number, name: string }[];
  genre_ids?: number[];
  popularity?: number;
  detailsFetched?: boolean;
  genreNames?: string[];
}

interface WatchlistState {
  items: WatchlistItem[];
  addItem: (item: WatchlistItem) => boolean;
  removeItem: (id: number) => void;
  reorderItems: (items: WatchlistItem[]) => void;
  hasItem: (id: number) => boolean;
  syncWithSupabase: () => Promise<void>;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const exists = get().hasItem(item.id);
        if (exists) {
          return false;
        }
        set((state) => ({
          items: [...state.items, item],
        }));
        
        // Sync with Supabase
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            supabase.from('watchlist').upsert({
              user_id: data.user.id,
              item_id: item.id,
              item_data: item,
              created_at: new Date().toISOString()
            }).then(result => {
              if (result.error) {
                console.error('Error adding to watchlist:', result.error);
              }
            });
          }
        });
        
        return true;
      },
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
        
        // Remove from Supabase
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            supabase.from('watchlist')
              .delete()
              .eq('user_id', data.user.id)
              .eq('item_id', id)
              .then(result => {
                if (result.error) {
                  console.error('Error removing from watchlist:', result.error);
                }
              });
          }
        });
      },
      reorderItems: (items) => {
        set(() => ({
          items,
        }));
        
        // Update order in Supabase
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            // Get existing items and update them
            items.forEach((item, index) => {
              supabase.from('watchlist').upsert({
                user_id: data.user.id,
                item_id: item.id,
                item_data: item,
                order: index
              }).then(result => {
                if (result.error) {
                  console.error('Error reordering watchlist:', result.error);
                }
              });
            });
          }
        });
      },
      hasItem: (id) => {
        return get().items.some((item) => item.id === id);
      },
      syncWithSupabase: async () => {
        try {
          console.log('Syncing watchlist with Supabase');
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            // Fetch watchlist from Supabase using proper API format
            const { data: watchlistData, error } = await supabase
              .from('watchlist')
              .select('*')
              .eq('user_id', userData.user.id);
              
            if (error) {
              console.error('Supabase query error:', error);
              return;
            }
              
            if (watchlistData && watchlistData.length > 0) {
              console.log('Retrieved watchlist items:', watchlistData.length);
              // Create a new array with the items
              const items = watchlistData.map(item => item.item_data as WatchlistItem);
              set({ items });
            } else {
              console.log('No watchlist items found');
            }
          } else {
            console.log('No user data found');
          }
        } catch (error) {
          console.error('Error syncing with Supabase:', error);
        }
      }
    }),
    {
      name: 'watchlist-storage',
    }
  )
); 