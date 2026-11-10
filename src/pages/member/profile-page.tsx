import { Link } from "@tanstack/react-router";
import { useProfilePreviewStore } from "../../store/profile-preview-store";

export function ProfilePage() {
  const profile = useProfilePreviewStore((state) => state.profile);

  return (
    <main className="auth-page profile-page">
      <section className="auth-card profile-card" aria-labelledby="profile-heading">
        <div className="profile-title-row">
          <h1 id="profile-heading" className="auth-heading">내 정보</h1>
          <Link className="text-button" to="/mypage/edit"><img src="/icons/edit.svg" alt="" width="16" height="16" />정보 수정</Link>
        </div>
        <p className="auth-description">나의 회원 정보를 확인해 보세요.</p>
        <p className="preview-notice">예시 회원 정보입니다. 새로고침하면 처음 정보로 돌아갑니다.</p>
        <div className="profile-summary">
          <div className="profile-avatar" aria-hidden="true"><img src="/icons/person.svg" alt="" width="44" height="44" /></div>
          <p><strong>{profile.nickname}</strong><span>반가워요!</span></p>
        </div>
        <dl className="profile-details">
          <div><dt>이메일</dt><dd>{profile.email}</dd></div>
          <div><dt>닉네임</dt><dd>{profile.nickname}</dd></div>
        </dl>
        <Link className="primary-button" to="/mypage/edit">내 정보 수정</Link>
        <Link className="preview-link" to="/login">로그인 화면으로 돌아가기</Link>
      </section>
    </main>
  );
}
