import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MemberField } from "../../components/auth/member-field";
import { isNicknameValid } from "../../lib/member-form";
import { useProfilePreviewStore } from "../../store/profile-preview-store";

export function EditProfilePage() {
  const profile = useProfilePreviewStore((state) => state.profile);
  const updateNickname = useProfilePreviewStore((state) => state.updateNickname);
  const [nickname, setNickname] = useState(profile.nickname);
  const [touched, setTouched] = useState(false);
  const navigate = useNavigate();
  const valid = isNicknameValid(nickname);
  const dirty = nickname.trim() !== profile.nickname;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!valid || !dirty || !updateNickname(nickname)) return;
    void navigate({ to: "/mypage" });
  }

  return (
    <main className="auth-page profile-page">
      <section className="auth-card profile-card" aria-labelledby="edit-profile-heading">
        <h1 id="edit-profile-heading" className="auth-heading">내 정보 수정</h1>
        <p className="auth-description">영화를 함께 이야기할 이름을 정해 보세요.</p>
        <p className="preview-notice">미리보기의 예시 정보만 변경돼요. 실제 계정에는 반영되지 않습니다.</p>
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <MemberField label="이메일" name="email" type="email" value={profile.email} readOnly hint="이메일은 변경할 수 없어요." />
          <MemberField
            label="닉네임" name="nickname" autoComplete="nickname" required
            placeholder="닉네임을 입력해 주세요." value={nickname}
            onChange={(event) => { setNickname(event.target.value); setTouched(true); }}
            onBlur={() => setTouched(true)}
            error={touched && !valid ? "닉네임은 앞뒤 공백을 제외하고 2~12자로 입력해 주세요." : undefined}
            hint="앞뒤 공백을 제외한 2~12자로 입력해 주세요."
          />
          <div className="form-actions">
            <Link className="secondary-button" to="/mypage">취소</Link>
            <button className="primary-button" type="submit" disabled={!valid || !dirty}>저장하기</button>
          </div>
        </form>
      </section>
    </main>
  );
}
