import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { addFavorite, deleteFavorite, getFavorite, getFavorites, type Favorite } from "../api/favorites";
import { useAuthStore } from "../store/auth-store";
import { requireMemberSession } from "../lib/member-session";

export const favoriteKeys = {
  all: (memberId: number | null) => ["favorites", memberId] as const,
  list: (memberId: number | null) => ["favorites", memberId, "list"] as const,
  detail: (memberId: number | null, movieId: number) => ["favorites", memberId, "detail", movieId] as const,
  mutation: (memberId: number | null, movieId: number) => ["favorites", memberId, "toggle", movieId] as const,
};

export const favoriteQueries = {
  list: (memberId: number | null) => queryOptions({
    queryKey: favoriteKeys.list(memberId),
    queryFn: ({ signal }) => { requireMemberSession(memberId); return getFavorites(signal); },
    enabled: memberId !== null,
    staleTime: 0,
    retry: false,
  }),
  detail: (memberId: number | null, movieId: number) => queryOptions({
    queryKey: favoriteKeys.detail(memberId, movieId),
    queryFn: ({ signal }) => { requireMemberSession(memberId); return getFavorite(movieId, signal); },
    enabled: memberId !== null && Number.isSafeInteger(movieId) && movieId > 0,
    staleTime: 0,
    retry: false,
  }),
};

export function useToggleFavorite(movieId: number) {
  const memberId = useAuthStore((state) => state.memberId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationKey: favoriteKeys.mutation(memberId, movieId),
    mutationFn: async (isFavorite: boolean) => {
      requireMemberSession(memberId, accessToken);
      if (isFavorite) return addFavorite(movieId);
      await deleteFavorite(movieId);
      return { movieId, isFavorite: false };
    },
    onMutate: () => client.cancelQueries({ queryKey: favoriteKeys.all(memberId) }),
    onSuccess: async (status) => {
      if (useAuthStore.getState().accessToken !== accessToken) return;
      client.setQueryData(favoriteKeys.detail(memberId, movieId), status);
      client.setQueryData<Favorite[]>(favoriteKeys.list(memberId), (current) => {
        if (!current) return undefined;
        const rest = current.filter((favorite) => favorite.movieId !== movieId);
        return status.isFavorite ? [...rest, { movieId }] : rest;
      });
      await client.invalidateQueries({ queryKey: favoriteKeys.list(memberId) });
    },
    onError: () => {
      if (useAuthStore.getState().accessToken === accessToken) {
        void client.invalidateQueries({ queryKey: favoriteKeys.all(memberId) });
      }
    },
    retry: false,
  });
}
