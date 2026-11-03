import MoviePoster from "../../components/movies/movie-poster";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import BookmarkButton from "../../components/movies/bookmark-button";
import Pagination from "../../components/movies/pagination";
import { getMovieErrorMessage } from "../../lib/movie-error";
import { movieQueries } from "../../queries/movies";
import { QueryActivity, RequestState } from "./request-state";

export function SearchPage() {
  const { query, page: requestedPage } = useSearch({ from: "/search" });
  const page = requestedPage ?? 1;
  const navigate = useNavigate({ from: "/search" });
  const [searchText, setSearchText] = useState(query ?? "");
  const normalizedQuery = query?.trim() ?? "";
  const request = useQuery(movieQueries.search(normalizedQuery, page));

  useEffect(() => setSearchText(query ?? ""), [query]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchText.trim();
    void navigate({ search: nextQuery ? { query: nextQuery } : {} });
  }

  function changePage(nextPage: number) {
    void navigate({ search: { query: normalizedQuery, ...(nextPage === 1 ? {} : { page: nextPage }) } });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <main className="mx-auto w-[1200px] max-w-[calc(100%-48px)] pt-12 pb-20">
      <h1 className="mb-8 text-[28px] leading-[1.3] font-bold">영화 검색</h1>
      <form className="mb-10 flex gap-3" onSubmit={handleSubmit} role="search">
        <input
          type="search"
          aria-label="검색어"
          placeholder="영화 제목을 검색해 주세요."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="h-[52px] min-w-0 flex-1 rounded-[10px] border border-[#ddd] px-[18px] outline-none transition focus:border-[#111]"
        />
        <button className="w-24 rounded-[10px] border-0 bg-[#111] text-white" type="submit">검색</button>
      </form>

      {!normalizedQuery ? (
        <RequestState title="검색어를 입력해 주세요." description="영화 제목으로 검색할 수 있어요." />
      ) : (
        <section aria-label="영화 검색 결과">
          <h2 className="mb-6 text-[22px] font-bold">“{normalizedQuery}” 검색 결과</h2>
          <QueryActivity query={request} />
          {request.isPending && <RequestState title="검색 결과를 불러오고 있어요." loading />}
          {request.isError && request.data === undefined && <RequestState title="검색 결과를 불러오지 못했어요." description={getMovieErrorMessage(request.error)} onRetry={() => void request.refetch()} />}
          {request.data !== undefined && (
            <>
              <p className="mb-6 text-[#777]" role="status">영화 {request.data.totalResults.toLocaleString("ko-KR")}편</p>
              {request.data.movies.length === 0 ? (
                <>
                  <RequestState title="검색 결과가 없어요." description={page > 1 ? "첫 페이지로 돌아가 검색 결과를 확인해 주세요." : "다른 영화 제목으로 검색해 주세요."} />
                  {page > 1 && <button type="button" className="mx-auto mt-6 block rounded-lg bg-[#111] px-5 py-3 text-sm text-white" onClick={() => changePage(1)}>첫 페이지로 이동</button>}
                </>
              ) : (
                <>
                  <ul className="m-0 grid list-none gap-6 p-0">
                    {request.data.movies.map((movie) => (
                      <li key={movie.id} className="grid grid-cols-[140px_1fr] gap-6 border-b border-[#eee] pb-6">
                        <div className="relative self-start">
                          <Link to="/movies/$movieId" params={{ movieId: String(movie.id) }}>
                            <MoviePoster className="block aspect-[2/3] w-[140px] rounded-lg object-cover" src={movie.posterPath} alt={`${movie.title} 포스터`} />
                          </Link>
                          <BookmarkButton movieId={movie.id} movieTitle={movie.title} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="my-2 text-[21px] font-bold">
                            <Link to="/movies/$movieId" params={{ movieId: String(movie.id) }}>{movie.title}</Link>
                          </h3>
                          <p className="my-1 text-[#777]">{movie.originalTitle}</p>
                          <p className="my-1 text-[#777]">{movie.releaseDate}</p>
                          <p className="mt-[18px] max-w-[760px] leading-[1.7] text-[#444]">{movie.overview || "등록된 줄거리가 없어요."}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination currentPage={page} totalPages={request.data.totalPages} onPageChange={changePage} />
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
