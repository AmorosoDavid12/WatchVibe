import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getCurrentSession } from '@/lib/supabase';

export interface WatchlistItem {
  id: number;
  title: string;
  media_type: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
}

interface WatchlistState {
  items: WatchlistItem[];
  isLoading: boolean;
  isInitialized: boolean;
  addItem: (item: WatchlistItem) => boolean;
  removeItem: (id: number) => void;
  reorderItems: (items: WatchlistItem[]) => void;
  hasItem: (id: number) => boolean;
  syncWithSupabase: () => Promise<boolean>;
}

// Create a simplified table name that definitely exists in the database
const TABLE_NAME = 'user_items';

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isInitialized: false,
      addItem: (item: WatchlistItem) => {
        // First update local state immediately for UI responsiveness
        const exists = get().hasItem(item.id);
        if (exists) {
          return false;
        }
        
        set((state) => ({
          items: [...state.items, item],
        }));
        
        // Then sync with Supabase
        (async () => {
          try {
            // Get authenticated session
            const session = await getCurrentSession();
            if (!session?.user) {
              console.log('No authenticated user found, skipping Supabase sync');
              return;
            }
            
            console.log('Adding to watchlist:', { id: item.id, title: item.title });
            
            // Use a simple approach with a basic table structure
            const result = await supabase.from(TABLE_NAME).upsert({
              user_id: session.user.id,
              // Make the key unique by combining user_id, item_id and type
              item_key: `watchlist_${item.id}`,
              // Store the item as a JSON string in a 'value' column
              value: JSON.stringify(item),
              // Add a type field to distinguish watchlist vs watched items
              type: 'watchlist',
              // Add updated_at for sorting
              updated_at: new Date().toISOString()
            });
            
            if (result.error) {
              console.error('Error adding to watchlist:', result.error);
            } else {
              console.log(`Added item ${item.id} to watchlist for user ${session.user.id}`);
            }
          } catch (error) {
            console.error('Error syncing watchlist item:', error);
          }
        })();
        
        return true;
      },
      removeItem: (id) => {
        // First update local state immediately
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
        
        // Then sync with Supabase
        (async () => {
          try {
            // Get authenticated session
            const session = await getCurrentSession();
            if (!session?.user) {
              console.log('No authenticated user found, skipping Supabase sync');
              return;
            }
            
            console.log(`Removing item ${id} from watchlist for user ${session.user.id}`);
            
            // Create a timeout promise
            const timeoutPromise = new Promise((resolve) => 
              setTimeout(() => {
                console.log('Delete operation timed out');
                resolve({ error: null });
              }, 5000) // Increased timeout to 5 seconds
            );
            
            // Send delete request to Supabase with timeout
            const deletePromise = supabase
              .from(TABLE_NAME)
              .delete()
              .match({ 
                user_id: session.user.id,
                item_key: `watchlist_${id}`,
                type: 'watchlist'
              });
            
            const result = await Promise.race([
              deletePromise,
              timeoutPromise
            ]) as any;
            
            if (result.error) {
              console.error('Error removing from watchlist:', result.error);
            } else {
              console.log(`Successfully removed item ${id} from watchlist in database`);
            }
          } catch (error) {
            console.error('Error syncing watchlist removal:', error);
          }
        })();
      },
      reorderItems: (items) => {
        // Update local state
        set(() => ({ items }));
        
        // No need to sync order to Supabase in this simplified approach
        // Items will be ordered by updated_at timestamp when fetched
      },
      hasItem: (id) => {
        return get().items.some((item) => item.id === id);
      },
      syncWithSupabase: async () => {
        try {
          // Set loading state to true at the beginning of sync
          set({ isLoading: true });
          
          // Check for an authenticated session
          const session = await getCurrentSession();
          if (!session?.user) {
            console.log('No authenticated user found, skipping Supabase sync');
            set({ isLoading: false, isInitialized: true });
            return false;
          }

          console.log('Syncing watchlist with Supabase');
          
          // Create a timeout promise
          const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => {
              console.log('Watchlist sync timed out');
              resolve({ data: null, error: new Error('Timeout') });
            }, 8000) // Extended timeout for potentially slow connections
          );
          
          // Fetch data from Supabase with timeout
          const fetchPromise = supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', session.user.id)
            .eq('type', 'watchlist')
            .order('updated_at', { ascending: false });
          
          const { data, error } = await Promise.race([
            fetchPromise,
            timeoutPromise
          ]) as any;
          
          if (error) {
            console.error('Error fetching watchlist items:', error);
            set({ isLoading: false, isInitialized: true });
            return false;
          }
          
          if (!data || data.length === 0) {
            console.log('No watchlist data received');
            // If we had items before but now we got none, keep the existing items
            // to prevent flickering on brief network issues - only clear if it's first load
            const currentItems = get().items;
            if (!get().isInitialized || currentItems.length === 0) {
              // Only update with empty array on first load
              set({ items: [], isLoading: false, isInitialized: true });
            } else {
              console.log('Preserving existing watchlist items due to empty response');
              set({ isLoading: false, isInitialized: true });
            }
            return true; // No data is not an error
          }

          console.log(`Fetched ${data.length} watchlist items from Supabase`);
          
          // Parse JSON from value field
          const items = data.map((row: any) => {
            try {
              return JSON.parse(row.value);
            } catch (e) {
              console.error('Error parsing item data:', e);
              return null;
            }
          }).filter(Boolean); // Remove null items
          
          // Set the loading state to false and update items
          set({ items, isLoading: false, isInitialized: true });
          
          return true;
        } catch (error) {
          console.error('Error syncing watchlist:', error);
          // Make sure to set loading to false even in error cases
          set({ isLoading: false, isInitialized: true });
          return false;
        }
      }
    }),
    {
      name: 'watchlist-storage',
    }
  )
); 