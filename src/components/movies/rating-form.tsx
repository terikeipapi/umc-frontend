"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import type { Rating, RatingInput } from "../../api/ratings";
import { useAuthStore } from "../../store/auth-store";
import { ratingKeys, ratingQueries, useDeleteRating, useSaveRating } from "../../queries/ratings";
import { getMemberErrorMessage } from "../../lib/member-session";

export function RatingForm({ movieId }: { movieId: number }) {
  const memberId = useAuthStore((state) => state.memberId);
  return <MemberRatingForm key={memberId ?? "guest"} movieId={movieId} memberId={memberId} />;
}

function MemberRatingForm({ movieId, memberId }: { movieId: number; memberId: number | null }) {
  const request = useQuery(ratingQueries.member(memberId));
  const save = useSaveRating(movieId);
  const remove = useDeleteRating(movieId);
  const writing = useIsMutating({ mutationKey: ratingKeys.mutation(memberId, movieId) }) > 0;
  const [feedback, setFeedback] = useState("");
  const [editorVersion, setEditorVersion] = useState(0);
  const rating = request.data?.find((item) => item.movieId === movieId);

  return (
    <section className="mt-10 max-w-[680px] rounded-xl border border-white/20 bg-black/35 p-6" aria-labelledby="rating-heading">
      <h2 id="rating-heading" className="text-xl font-bold">나의 평점</h2>
      {memberId === null ? (
        <p className="mt-4 text-sm text-neutral-200"><Link className="underline" href={`/login?${new URLSearchParams({ redirect: `/movies/${movieId}` })}`}>로그인</Link>하고 평점과 후기를 남겨 보세요.</p>
      ) : request.isPending ? (
        <p className="mt-4 text-sm" role="status">내 평점을 불러오고 있어요.</p>
      ) : (
        <>
          {request.isError && <div className="mt-4 text-sm" role="alert"><p>{getMemberErrorMessage(request.error)}</p><button className="mt-2 underline" type="button" disabled={request.isFetching} onClick={() => void request.refetch()}>평점 다시 불러오기</button></div>}
          {request.data !== undefined && <RatingEditor
            key={editorVersion}
            rating={rating}
            busy={writing}
            disabled={writing || request.isError || request.isFetching}
            onChange={() => { setFeedback(""); save.reset(); remove.reset(); }}
            onSave={(input) => {
              setFeedback(""); remove.reset();
              save.mutate({ ...input, ratingId: rating?.ratingId }, { onSuccess: () => {
                setEditorVersion((version) => version + 1);
                setFeedback(rating ? "평점을 수정했어요." : "평점을 등록했어요.");
              } });
            }}
            onDelete={() => {
              if (!rating) return;
              setFeedback(""); save.reset();
              remove.mutate(rating.ratingId, { onSuccess: () => {
                setEditorVersion((version) => version + 1);
                setFeedback("평점을 삭제했어요.");
              } });
            }}
          />}
          {(save.isError || remove.isError) && <p className="mt-4 text-sm text-red-200" role="alert">{getMemberErrorMessage(save.error ?? remove.error)}</p>}
          {feedback && <p className="mt-4 text-sm text-green-200" role="status">{feedback}</p>}
        </>
      )}
    </section>
  );
}

interface RatingEditorProps {
  rating?: Rating;
  busy: boolean;
  disabled: boolean;
  onChange: () => void;
  onSave: (input: RatingInput) => void;
  onDelete: () => void;
}

function RatingEditor({ rating, busy, disabled, onChange, onSave, onDelete }: RatingEditorProps) {
  const [score, setScore] = useState(rating?.score ?? 0);
  const [comment, setComment] = useState(rating?.comment ?? "");
  const valid = Number.isInteger(score) && score >= 1 && score <= 5 && comment.length <= 500;
  const dirty = !rating || score !== rating.score || comment.trim() !== (rating.comment ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !valid || !dirty) return;
    onSave({ score, comment });
  }

  return (
    <form className="mt-5 space-y-5" onSubmit={submit}>
      <fieldset disabled={disabled} className="space-y-5">
        <fieldset>
          <legend className="mb-3 text-sm">별점 (필수)</legend>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map((value) => <label key={value} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input type="radio" name="score" value={value} checked={score === value} required onChange={() => { setScore(value); onChange(); }} />{value}점
            </label>)}
          </div>
        </fieldset>
        <div>
          <label htmlFor="rating-comment" className="mb-2 block text-sm">후기 (선택)</label>
          <textarea id="rating-comment" name="comment" className="min-h-24 w-full rounded-lg border border-white/30 bg-white/10 p-3 text-sm text-white" placeholder="이 영화는 어떠셨나요?" maxLength={500} value={comment} aria-describedby="rating-comment-count" onChange={(event) => { setComment(event.target.value); onChange(); }} />
          <p id="rating-comment-count" className="mt-1 text-right text-xs text-neutral-300">{comment.length}/500자</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={disabled || !valid || !dirty} className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40">{busy ? "처리 중…" : rating ? "평점 수정" : "평점 등록"}</button>
          {rating && <button type="button" disabled={disabled} onClick={onDelete} className="rounded-lg border border-white/40 px-5 py-3 text-sm disabled:opacity-40">평점 삭제</button>}
        </div>
      </fieldset>
    </form>
  );
}
