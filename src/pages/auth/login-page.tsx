import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { MemberField } from "../../components/auth/member-field";
import { canPreviewLogin, isEmailValid } from "../../lib/member-form";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!canPreviewLogin(email, password)) return;
    setFeedback("입력 내용을 확인했어요. 화면 미리보기에서는 실제로 로그인되지 않아요.");
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <h1 id="login-heading" className="auth-heading">로그인</h1>
        <p className="auth-description">다시 만나 반가워요.</p>
        <p className="preview-notice">화면 미리보기 · 실제 계정에 로그인하지 않습니다.</p>
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <MemberField
            label="이메일" name="email" type="email" autoComplete="username" required maxLength={254}
            placeholder="이메일을 입력해 주세요."
            value={email}
            onChange={(event) => { setEmail(event.target.value); setFeedback(""); }}
            onBlur={() => setTouched((value) => ({ ...value, email: true }))}
            error={(touched.email || email.length > 0) && !isEmailValid(email) ? "올바른 이메일 형식을 입력해 주세요." : undefined}
          />
          <div>
            <MemberField
              label="비밀번호" name="password" type={showPassword ? "text" : "password"}
              autoComplete="current-password" required placeholder="비밀번호를 입력해 주세요."
              value={password}
              onChange={(event) => { setPassword(event.target.value); setFeedback(""); }}
              onBlur={() => setTouched((value) => ({ ...value, password: true }))}
              error={touched.password && !password ? "비밀번호를 입력해 주세요." : undefined}
            />
            <button className="text-button password-toggle" type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            </button>
          </div>
          <button className="primary-button" type="submit" disabled={!canPreviewLogin(email, password)}>로그인</button>
          {feedback && <p className="form-feedback" role="status">{feedback}</p>}
        </form>
        <p className="auth-footer">아직 회원이 아니신가요? <Link to="/signup">회원가입</Link></p>
        <Link className="preview-link" to="/mypage">내 정보 화면 미리보기 <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
