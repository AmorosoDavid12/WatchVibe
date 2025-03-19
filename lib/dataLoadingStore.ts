import { create } from 'zustand';
import { getCurrentSession } from '@/lib/supabase';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { useWatchedStore } from '@/lib/watchedStore';

interface DataLoadingState {
  isDataSynced: boolean;
  isSyncInProgress: boolean;
  lastSyncTime: number;
  syncError: string | null;
  
  // Actions
  syncAllData: () => Promise<boolean>;
  markDataSynced: (synced: boolean) => void;
  resetSyncState: () => void;
}

// Create a central store for data loading coordination
export const useDataLoadingStore = create<DataLoadingState>((set, get) => ({
  isDataSynced: false,
  isSyncInProgress: false,
  lastSyncTime: 0,
  syncError: null,
  
  // Synchronize all data stores with a more robust implementation
  syncAllData: async () => {
    // Prevent multiple simultaneous syncs
    if (get().isSyncInProgress) {
      console.log('[DataLoader] Sync already in progress, skipping');
      return false;
    }
    
    set({ 
      isSyncInProgress: true,
      syncError: null 
    });
    
    try {
      console.log('[DataLoader] Starting data synchronization');
      
      // Check if user is authenticated first
      const session = await getCurrentSession();
      if (!session?.user) {
        console.log('[DataLoader] No authenticated user, aborting sync');
        set({ 
          isSyncInProgress: false,
          isDataSynced: false
        });
        return false;
      }
      
      // Get sync functions directly from the stores
      // This is more reliable than importing functions from external modules
      const watchlistStore = useWatchlistStore.getState();
      const watchedStore = useWatchedStore.getState();
      
      // Create a promise that rejects after a timeout
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Data sync timeout after 10 seconds')), 10000);
      });
      
      // Race the actual sync operations with timeout
      const syncResult = await Promise.race([
        Promise.allSettled([
          watchlistStore.syncWithSupabase(),
          watchedStore.syncWithSupabase()
        ]).then(results => {
          // Check if at least one sync succeeded
          const anySuccess = results.some(result => 
            result.status === 'fulfilled' && result.value === true
          );
          return anySuccess;
        }),
        timeoutPromise
      ]);
      
      // Update state based on sync result
      set({ 
        isDataSynced: Boolean(syncResult),
        isSyncInProgress: false,
        lastSyncTime: Date.now(),
        syncError: null
      });
      
      console.log(`[DataLoader] Data sync ${syncResult ? 'completed successfully' : 'partially failed'}`);
      return Boolean(syncResult);
    } catch (error) {
      console.error('[DataLoader] Error syncing data:', error);
      set({ 
        isSyncInProgress: false,
        syncError: error instanceof Error ? error.message : 'Unknown error during sync',
        lastSyncTime: Date.now()
      });
      return false;
    }
  },
  
  // Manually mark data as synced (useful after login)
  markDataSynced: (synced: boolean) => {
    set({ 
      isDataSynced: synced,
      lastSyncTime: synced ? Date.now() : get().lastSyncTime 
    });
  },
  
  // Reset sync state (useful for logout)
  resetSyncState: () => {
    set({ 
      isDataSynced: false,
      isSyncInProgress: false,
      syncError: null 
    });
  }
})); 