import { Suspense } from "react";
import { MovieListPage } from "../features/movies/movie-list-page";

export default function HomePage() {
  return <Suspense fallback={<main role="status">영화를 불러오고 있어요.</main>}><MovieListPage /></Suspense>;
}
