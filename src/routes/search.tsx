import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "../pages/movies/search-page";

export const Route = createFileRoute("/search")({
  validateSearch: (search): { query?: string; page?: number } => {
    const page = Number(search.page);
    // TanStack parses numeric URL values, including movie titles such as 1917.
    const query = typeof search.query === "string" || typeof search.query === "number" || typeof search.query === "boolean"
      ? String(search.query).trim()
      : undefined;
    return {
      query,
      page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : undefined,
    };
  },
  component: SearchPage,
});
