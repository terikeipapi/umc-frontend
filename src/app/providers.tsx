"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SessionObserver } from "../components/auth/session-observer";
import { createQueryClient } from "../lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  // A mounted root layout keeps its cache across navigation; SSR gets a fresh client.
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionObserver />
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
