import MoviePoster from "./movie-poster";
import { Link } from "@tanstack/react-router";
import type { Movie } from "../../types/movie";
import BookmarkButton from "./bookmark-button";

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  return (
    <article className="min-w-0 [-webkit-tap-highlight-color:transparent]">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[10px] bg-[#eee]">
        <Link
          to="/movies/$movieId"
          params={{ movieId: String(movie.id) }}
          aria-label={`${movie.title} 상세 보기`}
        >
          <MoviePoster
            className="block size-full object-cover transition-transform duration-200 hover:scale-[1.02]"
            src={movie.posterPath}
            alt={`${movie.title} 포스터`}
          />
        </Link>
        <BookmarkButton movieId={movie.id} movieTitle={movie.title} />
      </div>
      <div className="mt-3">
        <h2 className="mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-base leading-[1.4] font-semibold">
          <Link to="/movies/$movieId" params={{ movieId: String(movie.id) }}>
            {movie.title}
          </Link>
        </h2>
        <p className="m-0 text-sm leading-6 text-[#777]">{movie.releaseDate}</p>
      </div>
    </article>
  );
}
