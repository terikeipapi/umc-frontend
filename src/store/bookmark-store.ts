import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface BookmarkState {
  bookmarkedMovieIds: number[];
  toggleBookmark: (movieId: number) => void;
  isBookmarked: (movieId: number) => boolean;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarkedMovieIds: [],
      toggleBookmark: (movieId) =>
        set((state) => ({
          bookmarkedMovieIds: state.bookmarkedMovieIds.includes(movieId)
            ? state.bookmarkedMovieIds.filter((id) => id !== movieId)
            : [...state.bookmarkedMovieIds, movieId],
        })),
      isBookmarked: (movieId) => get().bookmarkedMovieIds.includes(movieId),
    }),
    {
      // Sample-data IDs and TMDB IDs identify different movies. Keep legacy
      // bookmarks untouched in their old key and store real TMDB IDs separately.
      name: "umcine-tmdb-bookmark-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ bookmarkedMovieIds: state.bookmarkedMovieIds }),
    },
  ),
);
