import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { createRating, deleteRating, getMemberRatings, updateRating, type Rating, type RatingInput } from "../api/ratings";
import { requireMemberSession } from "../lib/member-session";
import { useAuthStore } from "../store/auth-store";

export const ratingKeys = {
  member: (memberId: number | null) => ["ratings", memberId] as const,
  mutation: (memberId: number | null, movieId: number) => ["ratings", memberId, "write", movieId] as const,
};

export const ratingQueries = {
  member: (memberId: number | null) => queryOptions({
    queryKey: ratingKeys.member(memberId),
    queryFn: ({ signal }) => { const session = requireMemberSession(memberId); return getMemberRatings(session.memberId, signal); },
    enabled: memberId !== null,
    staleTime: 0,
    retry: false,
  }),
};

export function useSaveRating(movieId: number) {
  const memberId = useAuthStore((state) => state.memberId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationKey: ratingKeys.mutation(memberId, movieId),
    mutationFn: (input: RatingInput & { ratingId?: number }) => {
      requireMemberSession(memberId, accessToken);
      return input.ratingId === undefined ? createRating({ movieId, ...input }) : updateRating(input.ratingId, input);
    },
    onMutate: () => client.cancelQueries({ queryKey: ratingKeys.member(memberId) }),
    onSuccess: async (saved) => {
      if (useAuthStore.getState().accessToken !== accessToken) return;
      client.setQueryData<Rating[]>(ratingKeys.member(memberId), (current) => [saved, ...(current ?? []).filter((rating) => rating.movieId !== movieId)]);
      await client.invalidateQueries({ queryKey: ratingKeys.member(memberId) });
    },
    onError: () => {
      if (useAuthStore.getState().accessToken === accessToken) void client.invalidateQueries({ queryKey: ratingKeys.member(memberId) });
    },
    retry: false,
  });
}

export function useDeleteRating(movieId: number) {
  const memberId = useAuthStore((state) => state.memberId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const client = useQueryClient();
  return useMutation({
    mutationKey: ratingKeys.mutation(memberId, movieId),
    mutationFn: (ratingId: number) => { requireMemberSession(memberId, accessToken); return deleteRating(ratingId); },
    onMutate: () => client.cancelQueries({ queryKey: ratingKeys.member(memberId) }),
    onSuccess: async (_result, ratingId) => {
      if (useAuthStore.getState().accessToken !== accessToken) return;
      client.setQueryData<Rating[]>(ratingKeys.member(memberId), (current) => (current ?? []).filter((rating) => rating.ratingId !== ratingId));
      await client.invalidateQueries({ queryKey: ratingKeys.member(memberId) });
    },
    onError: () => {
      if (useAuthStore.getState().accessToken === accessToken) void client.invalidateQueries({ queryKey: ratingKeys.member(memberId) });
    },
    retry: false,
  });
}
