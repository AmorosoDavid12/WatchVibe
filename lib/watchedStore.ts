import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WatchlistItem } from './watchlistStore';

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
  hasItem: (id: number) => boolean;
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
        return true;
      },
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      hasItem: (id) => {
        return get().items.some((item) => item.id === id);
      },
    }),
    {
      name: 'watched-storage',
    }
  )
); 