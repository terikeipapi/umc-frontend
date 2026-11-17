import { queryOptions } from "@tanstack/react-query";
import { getMyProfile } from "../api/members/me";
import { useAuthStore } from "../store/auth-store";
import { requireMemberSession } from "../lib/member-session";

export const memberQueries = {
  me: (memberId: number | null = useAuthStore.getState().memberId) => queryOptions({
    queryKey: ["member", memberId, "me"] as const,
    queryFn: ({ signal }) => { requireMemberSession(memberId); return getMyProfile(signal); },
    enabled: memberId !== null,
    retry: false,
  }),
};
