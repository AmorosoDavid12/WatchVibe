import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WatchlistItem } from './watchlistStore';
import { supabase } from './supabase';

export interface WatchedItem extends Omit<WatchlistItem, 'poster_path'> {
  poster_path: string | null;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number, name: string }[];
  genre_ids?: number[];
  popularity?: number;
}

interface WatchedState {
  items: WatchedItem[];
  addItem: (item: WatchedItem) => boolean;
  removeItem: (id: number) => void;
  reorderItems: (items: WatchedItem[]) => void;
  hasItem: (id: number) => boolean;
  syncWithSupabase: () => Promise<void>;
}

export const useWatchedStore = create<WatchedState>()(
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
        const userId = supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            supabase.from('watched').upsert({
              user_id: data.user.id,
              item_id: item.id,
              item_data: item,
              created_at: new Date().toISOString()
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
        const userId = supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            supabase.from('watched')
              .delete()
              .match({ user_id: data.user.id, item_id: id });
          }
        });
      },
      reorderItems: (items) => {
        set(() => ({
          items,
        }));
        
        // Update order in Supabase
        const userId = supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            // Get existing items and delete them
            items.forEach((item, index) => {
              supabase.from('watched').upsert({
                user_id: data.user.id,
                item_id: item.id,
                item_data: item,
                order: index
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
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            // Fetch watched from Supabase
            const { data: watchedData, error } = await supabase
              .from('watched')
              .select('*')
              .eq('user_id', userData.user.id)
              .order('order');
              
            if (!error && watchedData) {
              // Create a new array with the items sorted by order
              const items = watchedData.map(item => item.item_data as WatchedItem);
              set({ items });
            }
          }
        } catch (error) {
          console.error('Error syncing with Supabase:', error);
        }
      }
    }),
    {
      name: 'watched-storage',
    }
  )
); 