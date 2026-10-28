import MoviePoster from "../../components/movies/movie-poster";
import { Link, useParams } from "@tanstack/react-router";
import { getMovieDetails } from "../../api/movies";
import BookmarkButton from "../../components/movies/bookmark-button";
import { useMovieRequest } from "../../hooks/use-movie-request";
import { RequestState } from "./request-state";

export function MovieDetailPage() {
  const { movieId } = useParams({ from: "/movies/$movieId" });
  const request = useMovieRequest("movie:" + movieId, (signal) => getMovieDetails(movieId, signal));

  if (request.status !== "success") {
    return (
      <main className="mx-auto w-[1200px] max-w-[calc(100%-48px)] pt-12 pb-20">
        <Link className="mb-8 inline-block text-[#555]" to="/">← 영화 목록</Link>
        {request.status === "error" ? (
          <RequestState title="영화 정보를 불러오지 못했어요." description={request.error} onRetry={request.retry} />
        ) : (
          <RequestState title="영화 정보를 불러오고 있어요." loading />
        )}
      </main>
    );
  }

  const movie = request.data;
  if (!movie) {
    return (
      <main className="mx-auto w-[1200px] max-w-[calc(100%-48px)] pt-12 pb-20 text-center">
        <RequestState title="영화를 찾을 수 없어요." description="영화 주소를 확인하거나 목록에서 다른 영화를 선택해 주세요." />
        <Link className="mt-6 inline-block text-[#555] underline" to="/">영화 목록으로 돌아가기</Link>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#111]">
      <section
        className="relative min-h-[calc(100vh-72px)] bg-cover bg-center"
        style={{ backgroundImage: movie.backdropPath ? `url(${movie.backdropPath})` : undefined }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/95 via-neutral-950/80 to-neutral-950/35" />
        <div className="relative mx-auto grid w-[1200px] max-w-[calc(100%-48px)] grid-cols-[280px_1fr] gap-12 pt-12 pb-20 text-white">
          <Link className="col-span-full w-fit text-[#ddd]" to="/">← 영화 목록</Link>
          <div className="relative self-start">
            <MoviePoster className="w-[280px] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.45)]" src={movie.posterPath} alt={`${movie.title} 포스터`} />
            <BookmarkButton movieId={movie.id} movieTitle={movie.title} />
          </div>
          <div className="self-center">
            <p className="mb-2 text-[17px] text-[#ccc]">{movie.originalTitle}</p>
            <h1 className="mb-[18px] text-[44px] leading-[1.2] font-bold">{movie.title}</h1>
            <p className="mb-9 flex flex-wrap gap-3 text-[#ddd] [&>span+span]:before:mr-3 [&>span+span]:before:text-[#777] [&>span+span]:before:content-['•']">
              <span>{movie.releaseDate}</span>
              {movie.genres.length > 0 && <span>{movie.genres.join(" · ")}</span>}
              {movie.runtime && <span>{movie.runtime}</span>}
            </p>
            {movie.tagline && <h2 className="mb-3.5 text-2xl font-bold">{movie.tagline}</h2>}
            <p className="max-w-[680px] text-[17px] leading-[1.8] text-[#e2e2e2]">{movie.overview || "등록된 줄거리가 없어요."}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
