import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateQueries } from "../../lib/auth";
import { getSession, useAuthStore } from "../../store/auth-store";

export function SessionObserver() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function scheduleExpiration() {
      clearTimeout(timer);
      const session = getSession();
      if (!session) return;
      timer = setTimeout(() => {
        getSession();
        scheduleExpiration();
      }, Math.min(session.expiresAt - Date.now() + 1, 2_147_483_647));
    }
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.accessToken === previous.accessToken) return;
      clearPrivateQueries(queryClient);
      scheduleExpiration();
      void router.invalidate();
    });
    scheduleExpiration();
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [router, queryClient]);

  return null;
}
