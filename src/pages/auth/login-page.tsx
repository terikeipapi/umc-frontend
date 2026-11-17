import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MemberField } from "../../components/auth/member-field";
import { login } from "../../api/auth";
import { clearPrivateQueries, getSafeRedirect } from "../../lib/auth";
import { canPreviewLogin, isEmailValid } from "../../lib/member-form";
import { useAuthStore } from "../../store/auth-store";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const search = useSearch({ strict: false }) as { redirect?: string };
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!canPreviewLogin(email, password) || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFeedback("");
    try {
      const result = await login(email, password);
      clearPrivateQueries(queryClient);
      useAuthStore.getState().setSession(result.accessToken);
      setPassword("");
      await router.invalidate();
      await navigate({ href: getSafeRedirect(search.redirect), replace: true });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "로그인하지 못했어요. 다시 시도해 주세요.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <h1 id="login-heading" className="auth-heading">로그인</h1>
        <p className="auth-description">다시 만나 반가워요.</p>
        <form className="auth-form" noValidate aria-busy={pending} onSubmit={(event) => void handleSubmit(event)}>
          <MemberField
            label="이메일" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending}
            placeholder="이메일을 입력해 주세요."
            value={email}
            onChange={(event) => { setEmail(event.target.value); setFeedback(""); }}
            onBlur={() => setTouched((value) => ({ ...value, email: true }))}
            error={(touched.email || email.length > 0) && !isEmailValid(email) ? "올바른 이메일 형식을 입력해 주세요." : undefined}
          />
          <div>
            <MemberField
              label="비밀번호" name="password" type={showPassword ? "text" : "password"} disabled={pending}
              autoComplete="current-password" required placeholder="비밀번호를 입력해 주세요."
              value={password}
              onChange={(event) => { setPassword(event.target.value); setFeedback(""); }}
              onBlur={() => setTouched((value) => ({ ...value, password: true }))}
              error={touched.password && !password ? "비밀번호를 입력해 주세요." : undefined}
            />
            <button className="text-button password-toggle" type="button" disabled={pending} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            </button>
          </div>
          <button className="primary-button" type="submit" disabled={pending || !canPreviewLogin(email, password)}>{pending ? "로그인 중…" : "로그인"}</button>
          {feedback && <p className="form-feedback" role="alert">{feedback}</p>}
        </form>
        <p className="auth-footer">아직 회원이 아니신가요? <Link to="/signup">회원가입</Link></p>
      </section>
    </main>
  );
}
