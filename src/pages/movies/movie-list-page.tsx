import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import MovieGrid from "../../components/movies/movie-grid";
import Pagination from "../../components/movies/pagination";
import { getMovieErrorMessage } from "../../lib/movie-error";
import { movieQueries } from "../../queries/movies";
import { QueryActivity, RequestState } from "./request-state";

export function MovieListPage() {
  const { page: requestedPage } = useSearch({ from: "/" });
  const page = requestedPage ?? 1;
  const navigate = useNavigate({ from: "/" });
  const request = useQuery(movieQueries.popular(page));

  function changePage(nextPage: number) {
    void navigate({ search: nextPage === 1 ? {} : { page: nextPage } });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <main className="mx-auto w-[1200px] max-w-[calc(100%-48px)] pt-12 pb-20">
      <h1 className="mb-8 text-[28px] leading-[1.3] font-bold">인기 영화</h1>
      <QueryActivity query={request} />
      {request.isPending && <RequestState title="인기 영화를 불러오고 있어요." loading />}
      {request.isError && request.data === undefined && <RequestState title="영화 목록을 불러오지 못했어요." description={getMovieErrorMessage(request.error)} onRetry={() => void request.refetch()} />}
      {request.data !== undefined && (
        request.data.movies.length === 0 ? (
          <div>
            <RequestState title="표시할 영화가 없어요." description={page > 1 ? "다른 페이지에서 영화를 찾아보세요." : "잠시 후 다시 확인해 주세요."} />
            {page > 1 && <button type="button" className="mx-auto mt-6 block rounded-lg bg-[#111] px-5 py-3 text-sm text-white" onClick={() => changePage(1)}>첫 페이지로 이동</button>}
          </div>
        ) : (
          <>
            <MovieGrid movies={request.data.movies} />
            <Pagination currentPage={page} totalPages={request.data.totalPages} onPageChange={changePage} />
          </>
        )
      )}
    </main>
  );
}
