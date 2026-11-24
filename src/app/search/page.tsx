import { Suspense } from "react";
import { SearchPage } from "../../features/movies/search-page";

export default function SearchRoute() {
  return <Suspense fallback={<main role="status">검색 화면을 불러오고 있어요.</main>}><SearchPage /></Suspense>;
}
