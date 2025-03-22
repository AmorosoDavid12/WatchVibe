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
  lastSyncUserId: string | null;
  addItem: (item: WatchlistItem) => Promise<boolean>;
  removeItem: (id: number) => Promise<boolean>;
  reorderItems: (items: WatchlistItem[]) => void;
  hasItem: (id: number) => boolean;
  syncWithSupabase: () => Promise<boolean>;
  resetStore: () => void;
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
      lastSyncUserId: null,
      
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
          
          const userId = session.user.id;
          // Update user ID reference to ensure we're syncing for the correct user
          set(state => ({ ...state, lastSyncUserId: userId }));
          
          console.log('Adding to watchlist:', { id: item.id, title: item.title, userId });
          
          // Save to server first
          const success = await saveUserItem(userId, item, 'watchlist');
          
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
          
          const userId = session.user.id;
          // Update user ID reference to ensure we're syncing for the correct user
          set(state => ({ ...state, lastSyncUserId: userId }));
          
          console.log(`Removing item ${id} from watchlist for user ${userId}`);
          
          // Remove from server first
          const success = await removeUserItem(userId, id, 'watchlist');
          
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
      
      // Reset store completely (for logout/account switching)
      resetStore: () => {
        set({
          items: [],
          isLoading: false,
          isInitialized: false,
          syncInProgress: false,
          lastSyncTime: 0,
          lastSyncUserId: null
        });
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
        
        // Get session to check user ID first
        const session = await getCurrentSession();
        if (!session?.user) {
          console.log('No authenticated user found, skipping watchlist sync');
          set({ 
            isLoading: false, 
            isInitialized: true,
            syncInProgress: false,
            lastSyncTime: now
          });
          return false;
        }
        
        const userId = session.user.id;
        const userChanged = state.lastSyncUserId !== null && state.lastSyncUserId !== userId;
        
        // Always sync if user has changed
        if (!userChanged && now - state.lastSyncTime < MIN_SYNC_INTERVAL && state.isInitialized) {
          console.log('Watchlist synced recently for same user, skipping');
          return true;
        }
        
        // If user changed, we need to reset and sync
        if (userChanged) {
          console.log('User changed since last watchlist sync, forcing refresh');
          // Reset items but keep loading state to avoid UI flicker
          set({ 
            items: [],
            isInitialized: false
          });
        }
        
        // Set loading and sync in progress state
        set({ isLoading: true, syncInProgress: true });
        
        try {
          // Fetch items from server with retry built into fetchUserItems
          const items = await fetchUserItems(userId, 'watchlist');
          
          // Update state with fetched items and current user ID
          set({ 
            items,
            isLoading: false,
            isInitialized: true,
            syncInProgress: false,
            lastSyncTime: now,
            lastSyncUserId: userId
          });
          
          return true;
        } catch (error) {
          console.error('Error syncing watchlist:', error);
          set({ 
            isLoading: false, 
            isInitialized: true,
            syncInProgress: false,
            lastSyncTime: now,
            lastSyncUserId: userId
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