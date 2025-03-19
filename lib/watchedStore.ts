import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getCurrentSession } from '@/lib/supabase';

export interface WatchedItem {
  id: number;
  title: string;
  media_type: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  rating?: number;
  watched_date?: string;
}

interface WatchedState {
  items: WatchedItem[];
  isLoading: boolean;
  isInitialized: boolean;
  syncInProgress: boolean;
  lastSyncTime: number;
  addItem: (item: WatchedItem) => boolean;
  removeItem: (id: number) => void;
  reorderItems: (items: WatchedItem[]) => void;
  hasItem: (id: number) => boolean;
  syncWithSupabase: () => Promise<boolean>;
}

// Use the same table as watchlist but with a different type
const TABLE_NAME = 'user_items';
const MIN_SYNC_INTERVAL = 10000; // 10 seconds minimum between syncs

export const useWatchedStore = create<WatchedState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isInitialized: false,
      syncInProgress: false,
      lastSyncTime: 0,
      addItem: (item: WatchedItem) => {
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
            
            console.log('Adding to watched list:', { id: item.id, title: item.title });
            
            // Use a simple approach with a basic table structure
            const result = await supabase.from(TABLE_NAME).upsert({
              user_id: session.user.id,
              // Make the key unique by combining user_id, item_id and type
              item_key: `watched_${item.id}`,
              // Store the item as a JSON string in a 'value' column
              value: JSON.stringify(item),
              // Add a type field to distinguish watchlist vs watched items
              type: 'watched',
              // Add updated_at for sorting
              updated_at: new Date().toISOString()
            });
            
            if (result.error) {
              console.error('Error adding to watched list:', result.error);
            } else {
              console.log(`Added item ${item.id} to watched list for user ${session.user.id}`);
            }
          } catch (error) {
            console.error('Error syncing watched item:', error);
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
            
            console.log(`Removing item ${id} from watched list for user ${session.user.id}`);
            
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
                item_key: `watched_${id}`,
                type: 'watched'
              });
            
            const result = await Promise.race([
              deletePromise,
              timeoutPromise
            ]) as any;
            
            if (result.error) {
              console.error('Error removing from watched list:', result.error);
            } else {
              console.log(`Successfully removed item ${id} from watched list in database`);
            }
          } catch (error) {
            console.error('Error syncing watched removal:', error);
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
        // First check if we are already syncing or synced recently
        const state = get();
        const now = Date.now();
        
        if (state.syncInProgress) {
          console.log('Watched sync already in progress, skipping');
          return false;
        }
        
        // Prevent excessive syncing
        if (now - state.lastSyncTime < MIN_SYNC_INTERVAL && state.isInitialized) {
          console.log('Watched list synced recently, skipping');
          return true;
        }
        
        try {
          // Set loading and sync in progress state
          set({ isLoading: true, syncInProgress: true });
          
          // Check for an authenticated session
          const session = await getCurrentSession();
          if (!session?.user) {
            console.log('No authenticated user found, skipping Supabase sync');
            set({ 
              isLoading: false, 
              isInitialized: true,
              syncInProgress: false,
              lastSyncTime: now
            });
            return false;
          }

          console.log('Syncing watched list with Supabase');
          
          // Create a timeout promise - increased to 8 seconds
          const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => {
              console.log('Watched list sync timed out');
              resolve({ data: null, error: new Error('Timeout') });
            }, 8000)
          );
          
          // Fetch data from Supabase with timeout
          const fetchPromise = supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', session.user.id)
            .eq('type', 'watched')
            .order('updated_at', { ascending: false });
          
          const { data, error } = await Promise.race([
            fetchPromise,
            timeoutPromise
          ]) as any;
          
          if (error) {
            console.error('Error fetching watched items:', error);
            set({ 
              isLoading: false, 
              isInitialized: true,
              syncInProgress: false,
              lastSyncTime: now
            });
            return false;
          }
          
          // If we get no data (but no error either), keep existing items to prevent flickering
          // This is common when connection issues occur but isn't a critical failure
          if (!data || data.length === 0) {
            console.log('No watched data received, maintaining existing items');
            set({ 
              isLoading: false, 
              isInitialized: true,
              syncInProgress: false,
              lastSyncTime: now
            });
            return true; // No data is not an error
          }

          console.log(`Fetched ${data.length} watched items from Supabase`);
          
          // Parse JSON from value field
          const items = data.map((row: any) => {
            try {
              return JSON.parse(row.value);
            } catch (e) {
              console.error('Error parsing item data:', e);
              return null;
            }
          }).filter(Boolean); // Remove null items
          
          // Set the updated state
          set({ 
            items, 
            isLoading: false, 
            isInitialized: true,
            syncInProgress: false,
            lastSyncTime: now
          });
          
          return true;
        } catch (error) {
          console.error('Error syncing watched list:', error);
          // Make sure to set loading to false and update lastSyncTime even in error cases
          set({ 
            isLoading: false, 
            isInitialized: true,
            syncInProgress: false,
            lastSyncTime: now
          });
          return false;
        }
      }
    }),
    {
      name: 'watched-storage',
    }
  )
); 