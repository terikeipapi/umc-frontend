import { createFileRoute } from "@tanstack/react-router";
import { MovieListPage } from "../pages/movies/movie-list-page";

export const Route = createFileRoute("/")({
  validateSearch: (search): { page?: number } => {
    const page = Number(search.page);
    return { page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : undefined };
  },
  component: MovieListPage,
});
