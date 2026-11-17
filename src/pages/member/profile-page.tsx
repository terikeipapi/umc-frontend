import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth-store";
import { memberQueries } from "../../queries/member";
import { favoriteQueries, useToggleFavorite } from "../../queries/favorites";
import { movieQueries } from "../../queries/movies";
import { getMemberErrorMessage } from "../../lib/member-session";
import MovieCard from "../../components/movies/movie-card";
import { RequestState } from "../movies/request-state";

export function ProfilePage() {
  const memberId = useAuthStore((state) => state.memberId);
  const request = useQuery(memberQueries.me(memberId));
  const profile = request.data;

  return (
    <main className="auth-page profile-page">
      <section className="auth-card profile-card" aria-labelledby="profile-heading">
        <div className="profile-title-row">
          <h1 id="profile-heading" className="auth-heading">내 정보</h1>
          <Link className="text-button" to="/mypage/edit"><img src="/icons/edit.svg" alt="" width="16" height="16" />정보 수정</Link>
        </div>
        <p className="auth-description">나의 회원 정보를 확인해 보세요.</p>
        {!profile ? request.isError ? <RequestState title="내 정보를 불러오지 못했어요." description={getMemberErrorMessage(request.error)} onRetry={() => void request.refetch()} /> : <RequestState title="내 정보를 불러오고 있어요." loading /> : <>
        {request.isError && <p className="form-feedback" role="alert">{getMemberErrorMessage(request.error)} <button type="button" className="underline" onClick={() => void request.refetch()}>다시 시도</button></p>}
        <div className="profile-summary">
          <div className="profile-avatar" aria-hidden="true"><img src="/icons/person.svg" alt="" width="44" height="44" /></div>
          <p><strong>{profile.nickname}</strong><span>반가워요!</span></p>
        </div>
        <dl className="profile-details">
          <div><dt>이메일</dt><dd>{profile.email}</dd></div>
          <div><dt>닉네임</dt><dd>{profile.nickname}</dd></div>
        </dl>
        <Link className="primary-button" to="/mypage/edit">내 정보 수정</Link>
        </>}
      </section>
      <FavoriteMovies memberId={memberId} />
    </main>
  );
}

function FavoriteMovies({ memberId }: { memberId: number | null }) {
  const request = useQuery(favoriteQueries.list(memberId));
  return (
    <section className="mx-auto mt-16 w-full max-w-[1000px] border-t border-neutral-200 pt-10" aria-labelledby="favorites-heading">
      <h2 id="favorites-heading" className="mb-6 text-2xl font-bold">찜한 영화</h2>
      {request.isError && <div role="alert" className="mb-5 text-sm"><p>{getMemberErrorMessage(request.error)}</p><button className="mt-2 underline" type="button" onClick={() => void request.refetch()}>찜 목록 다시 불러오기</button></div>}
      {request.data === undefined ? !request.isError && <RequestState title="찜한 영화를 불러오고 있어요." loading /> : request.data.length === 0 ? <RequestState title="아직 찜한 영화가 없어요." description="영화 목록이나 상세 화면에서 북마크를 눌러 나만의 영화 목록을 만들어 보세요." /> : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {request.data.map((favorite) => <FavoriteMovie key={favorite.movieId} movieId={favorite.movieId} />)}
        </div>
      )}
      <Link className="mt-6 inline-block text-sm underline" to="/">영화 둘러보기</Link>
    </section>
  );
}

function FavoriteMovie({ movieId }: { movieId: number }) {
  const request = useQuery(movieQueries.detail(String(movieId)));
  const remove = useToggleFavorite(movieId);
  if (request.data) return <MovieCard movie={request.data} />;
  return (
    <article className="rounded-xl border border-neutral-200 p-5 text-sm">
      <Link className="font-semibold underline" to="/movies/$movieId" params={{ movieId: String(movieId) }}>영화 #{movieId}</Link>
      <p className="my-4 text-neutral-500" role={request.isError ? "alert" : "status"}>{request.isPending ? "영화 정보를 불러오고 있어요." : request.isError ? "영화 정보를 불러오지 못했어요. 찜 정보는 보관돼 있어요." : "현재 제공되지 않는 영화예요."}</p>
      {request.isError && <button className="mr-3 underline" type="button" onClick={() => void request.refetch()}>영화 정보 다시 불러오기</button>}
      <button className="underline disabled:opacity-50" type="button" disabled={remove.isPending} onClick={() => remove.mutate(false)}>{remove.isPending ? "해제 중…" : "찜 해제"}</button>
      {remove.isError && <p className="mt-3 text-red-700" role="alert">{getMemberErrorMessage(remove.error)}</p>}
    </article>
  );
}
