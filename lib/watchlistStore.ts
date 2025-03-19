import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getCurrentSession, fetchUserItems, saveUserItem, removeUserItem } from '@/lib/supabase';

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
  syncInProgress: boolean;
  lastSyncTime: number;
  addItem: (item: WatchlistItem) => Promise<boolean>;
  removeItem: (id: number) => Promise<boolean>;
  reorderItems: (items: WatchlistItem[]) => void;
  hasItem: (id: number) => boolean;
  syncWithSupabase: () => Promise<boolean>;
}

// Minimum time between syncs to prevent excessive API calls
const MIN_SYNC_INTERVAL = 10000; // 10 seconds

// Create a store with server-first approach
export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isInitialized: false,
      syncInProgress: false,
      lastSyncTime: 0,
      
      // Add item with server-first approach
      addItem: async (item: WatchlistItem) => {
        // Check if already exists
        if (get().hasItem(item.id)) {
          return false;
        }
        
        try {
          set({ isLoading: true });
          
          // Get session
          const session = await getCurrentSession();
          if (!session?.user) {
            set({ isLoading: false });
            return false;
          }
          
          // Save to server first
          const success = await saveUserItem(session.user.id, item, 'watchlist');
          
          // Only update local state if server update was successful
          if (success) {
            set((state) => ({
              items: [...state.items, item],
              isLoading: false
            }));
            return true;
          } else {
            set({ isLoading: false });
            return false;
          }
        } catch (error) {
          set({ isLoading: false });
          return false;
        }
      },
      
      // Remove item with server-first approach
      removeItem: async (id) => {
        try {
          // Get session
          const session = await getCurrentSession();
          if (!session?.user) {
            return false;
          }
          
          // Remove from server first
          const success = await removeUserItem(session.user.id, id, 'watchlist');
          
          // Only update local state if server update was successful
          if (success) {
            set((state) => ({
              items: state.items.filter((item) => item.id !== id)
            }));
            return true;
          }
          return false;
        } catch (error) {
          return false;
        }
      },
      
      // Update order (local only, server sorts by updated_at)
      reorderItems: (items) => {
        set({ items });
      },
      
      // Check if item exists in watchlist
      hasItem: (id) => {
        return get().items.some((item) => item.id === id);
      },
      
      // Sync with Supabase - always fetch from server
      syncWithSupabase: async () => {
        // First check if we are already syncing or synced recently
        const state = get();
        const now = Date.now();
        
        if (state.syncInProgress) {
          console.log('Watchlist sync already in progress, skipping');
          return false;
        }
        
        // Prevent excessive syncing
        if (now - state.lastSyncTime < MIN_SYNC_INTERVAL && state.isInitialized) {
          console.log('Watchlist synced recently, skipping');
          return true;
        }
        
        // Set loading and sync in progress state
        set({ isLoading: true, syncInProgress: true });
        
        try {
          const session = await getCurrentSession();
          if (!session?.user) {
            set({ 
              isLoading: false, 
              isInitialized: true,
              syncInProgress: false,
              lastSyncTime: now
            });
            return false;
          }
          
          // Fetch items from server with retry built into fetchUserItems
          const items = await fetchUserItems(session.user.id, 'watchlist');
          
          // If we get an empty array but no error, keep existing items to prevent flickering
          // Only update with empty array on the initial sync
          if (items.length === 0 && state.isInitialized && state.items.length > 0) {
            console.log('No watchlist data received, maintaining existing items');
            set({ 
              isLoading: false, 
              isInitialized: true,
              syncInProgress: false,
              lastSyncTime: now
            });
            return true;
          }
          
          // Update state with fetched items
          set({ 
            items,
            isLoading: false,
            isInitialized: true,
            syncInProgress: false,
            lastSyncTime: now
          });
          
          return true;
        } catch (error) {
          console.error('Error syncing watchlist:', error);
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
      name: 'watchlist-storage'
    }
  )
); 