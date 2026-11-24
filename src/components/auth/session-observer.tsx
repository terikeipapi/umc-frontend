"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateQueries } from "../../lib/auth";
import { AUTH_STORAGE_KEY, getSession, hydrateSession, useAuthStore } from "../../store/auth-store";

export function SessionObserver() {
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
    });
    hydrateSession();
    scheduleExpiration();
    function syncSession(event: StorageEvent) {
      if (event.key === AUTH_STORAGE_KEY || event.key === null) hydrateSession();
    }
    window.addEventListener("storage", syncSession);
    if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("tmdb-fetch") === "1") {
      void import("../../dev/tmdb-fetch-probe");
    }
    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener("storage", syncSession);
    };
  }, [queryClient]);

  return null;
}
