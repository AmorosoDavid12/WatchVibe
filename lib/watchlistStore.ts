import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        return true;
      },
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      reorderItems: (items) =>
        set(() => ({
          items,
        })),
      hasItem: (id) => {
        return get().items.some((item) => item.id === id);
      },
    }),
    {
      name: 'watchlist-storage',
    }
  )
); 