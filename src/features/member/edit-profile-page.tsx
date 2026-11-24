"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MemberField } from "../../components/auth/member-field";
import { updateMyProfile, type MemberProfile } from "../../api/members/me";
import { isNicknameValid } from "../../lib/member-form";
import { memberQueries } from "../../queries/member";
import { requireMemberSession } from "../../lib/member-session";
import { useAuthStore } from "../../store/auth-store";

export function EditProfilePage() {
  const memberId = useAuthStore((state) => state.memberId);
  const request = useQuery(memberQueries.me(memberId));
  return (
    <main className="auth-page profile-page">
      <section className="auth-card profile-card" aria-labelledby="edit-profile-heading">
        <h1 id="edit-profile-heading" className="auth-heading">내 정보 수정</h1>
        <p className="auth-description">영화를 함께 이야기할 이름을 정해 보세요.</p>
        {!request.data ? request.isError ? <div role="alert">
          <p>{request.error.message}</p><button className="secondary-button" type="button" onClick={() => void request.refetch()}>다시 시도</button>
        </div> : <p role="status">내 정보를 불러오고 있어요.</p> : <EditProfileForm key={memberId} profile={request.data} />}
      </section>
    </main>
  );
}

function EditProfileForm({ profile }: { profile: MemberProfile }) {
  const memberId = useAuthStore((state) => state.memberId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [nickname, setNickname] = useState(profile.nickname);
  const [touched, setTouched] = useState(false);
  const submitting = useRef(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: (value: string) => {
    requireMemberSession(memberId, accessToken);
    return updateMyProfile(value);
  } });
  const valid = isNicknameValid(nickname);
  const dirty = nickname.trim() !== profile.nickname;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!valid || !dirty || submitting.current) return;
    submitting.current = true;
    try {
      const updated = await mutation.mutateAsync(nickname);
      if (useAuthStore.getState().accessToken !== accessToken) return;
      queryClient.setQueryData(memberQueries.me(memberId).queryKey, updated);
      router.push("/mypage");
    } catch { /* Keep the draft while displaying the mutation error. */ }
    finally { submitting.current = false; }
  }

  return (
        <form className="auth-form" noValidate aria-busy={mutation.isPending} onSubmit={(event) => void handleSubmit(event)}>
          <MemberField label="이메일" name="email" type="email" value={profile.email} readOnly hint="이메일은 변경할 수 없어요." />
          <MemberField
            label="닉네임" name="nickname" autoComplete="nickname" required disabled={mutation.isPending}
            placeholder="닉네임을 입력해 주세요." value={nickname}
            onChange={(event) => { setNickname(event.target.value); setTouched(true); mutation.reset(); }}
            onBlur={() => setTouched(true)}
            error={touched && !valid ? "닉네임은 앞뒤 공백을 제외하고 2~12자로 입력해 주세요." : undefined}
            hint="앞뒤 공백을 제외한 2~12자로 입력해 주세요."
          />
          {mutation.isError && <p className="form-feedback" role="alert">{mutation.error.message}</p>}
          <div className="form-actions">
            {mutation.isPending ? <button className="secondary-button" type="button" disabled>취소</button> : <Link className="secondary-button" href="/mypage">취소</Link>}
            <button className="primary-button" type="submit" disabled={mutation.isPending || !valid || !dirty}>{mutation.isPending ? "저장 중…" : "저장하기"}</button>
          </div>
        </form>
  );
}
