import { Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/api-client";
import { checkEmailAvailable, checkNicknameAvailable } from "../../api/members/check-duplicate";
import { signup } from "../../api/members/signup";
import { isEmailValid, isNicknameValid, isSignupPasswordValid } from "../../lib/member-form";

type SignupForm = { email: string; nickname: string; password: string; passwordConfirm: string };
type DuplicateField = "email" | "nickname";
type CheckState = { value: string; status: "idle" | "available" | "unavailable" | "error"; message: string };
const emptyCheck = (): CheckState => ({ value: "", status: "idle", message: "" });
const initialForm: SignupForm = { email: "", nickname: "", password: "", passwordConfirm: "" };

function validate(form: SignupForm): Record<keyof SignupForm, string> {
  return {
    email: !form.email.trim() ? "이메일을 입력해 주세요." : !isEmailValid(form.email) ? "올바른 이메일을 입력해 주세요." : "",
    nickname: !isNicknameValid(form.nickname) ? "닉네임은 앞뒤 공백을 제외하고 2~12자로 입력해 주세요." : "",
    password: !isSignupPasswordValid(form.password)
      ? "영문 대문자·소문자·숫자·특수문자(!@#$%^&*)만 사용해 8~72자로 입력해 주세요."
      : "",
    passwordConfirm: !form.passwordConfirm ? "비밀번호를 한 번 더 입력해 주세요." : form.password !== form.passwordConfirm ? "비밀번호가 일치하지 않아요." : "",
  };
}

export function SignupPage() {
  const [form, setForm] = useState<SignupForm>(initialForm);
  const formRef = useRef(form);
  const [touched, setTouched] = useState<Partial<Record<keyof SignupForm, boolean>>>({});
  const [checks, setChecks] = useState<Record<DuplicateField, CheckState>>({ email: emptyCheck(), nickname: emptyCheck() });
  const [checking, setChecking] = useState({ email: false, nickname: false });
  const checkLocks = useRef({ email: false, nickname: false });
  const revisions = useRef({ email: 0, nickname: 0 });
  const verifiedValues = useRef<Record<DuplicateField, string | null>>({ email: null, nickname: null });
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [registered, setRegistered] = useState(false);
  const errors = validate(form);
  const canSubmit = !Object.values(errors).some(Boolean)
    && checks.email.status === "available" && checks.email.value === form.email.trim()
    && checks.nickname.status === "available" && checks.nickname.value === form.nickname.trim();

  function change(field: keyof SignupForm, value: string) {
    if (submitLock.current || ((field === "email" || field === "nickname") && checkLocks.current[field])) return;
    const nextForm = { ...formRef.current, [field]: value };
    formRef.current = nextForm;
    setForm(nextForm);
    setFeedback("");
    if (field === "email" || field === "nickname") {
      revisions.current[field] += 1;
      verifiedValues.current[field] = null;
      setChecks((current) => ({ ...current, [field]: emptyCheck() }));
    }
  }

  async function checkDuplicate(field: DuplicateField) {
    if (checkLocks.current[field] || submitLock.current) return;
    setTouched((current) => ({ ...current, [field]: true }));
    if (validate(formRef.current)[field]) return;
    const value = formRef.current[field].trim();
    const revision = revisions.current[field];
    checkLocks.current[field] = true;
    verifiedValues.current[field] = null;
    setChecking((current) => ({ ...current, [field]: true }));
    setChecks((current) => ({ ...current, [field]: emptyCheck() }));
    try {
      const available = await (field === "email" ? checkEmailAvailable(value) : checkNicknameAvailable(value));
      if (revisions.current[field] !== revision) return;
      verifiedValues.current[field] = available ? value : null;
      const label = field === "email" ? "이메일" : "닉네임";
      setChecks((current) => ({ ...current, [field]: {
        value,
        status: available ? "available" : "unavailable",
        message: available ? `사용 가능한 ${label}이에요.` : `이미 사용 중인 ${label}이에요.`,
      } }));
    } catch (error) {
      if (revisions.current[field] !== revision) return;
      setChecks((current) => ({ ...current, [field]: { value, status: "error", message: error instanceof Error ? error.message : "중복 확인에 실패했어요. 다시 시도해 주세요." } }));
    } finally {
      checkLocks.current[field] = false;
      setChecking((current) => ({ ...current, [field]: false }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || checkLocks.current.email || checkLocks.current.nickname) return;
    setTouched({ email: true, nickname: true, password: true, passwordConfirm: true });
    setFeedback("");
    const currentForm = formRef.current;
    if (Object.values(validate(currentForm)).some(Boolean)) return;
    if (verifiedValues.current.email !== currentForm.email.trim()
      || verifiedValues.current.nickname !== currentForm.nickname.trim()) {
      setFeedback("이메일과 닉네임 중복 확인을 완료해 주세요.");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const response = await signup({ email: currentForm.email, nickname: currentForm.nickname, password: currentForm.password });
      setFeedback(response.message);
      setRegistered(true);
      // Never retain passwords after a successful registration.
      const cleared = { ...currentForm, password: "", passwordConfirm: "" };
      formRef.current = cleared;
      setForm(cleared);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "회원가입에 실패했어요. 다시 시도해 주세요.");
      if (error instanceof ApiError && (error.code === "MEMBER4091" || error.code === "MEMBER4092")) {
        const field = error.code === "MEMBER4091" ? "email" : "nickname";
        verifiedValues.current[field] = null;
        setChecks((current) => ({ ...current, [field]: { value: currentForm[field].trim(), status: "unavailable", message: error.message } }));
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function duplicateField(field: DuplicateField, label: string, placeholder: string) {
    const error = touched[field] || form[field].length > 0 ? errors[field] : "";
    const check = checks[field];
    const message = error || check.message;
    return (
      <div className="form-field">
        <label className="field-label" htmlFor={`signup-${field}`}>{label}</label>
        <div className="field-row">
          <input id={`signup-${field}`} name={field} className="field-input" type={field === "email" ? "email" : "text"}
            autoComplete={field === "email" ? "email" : "nickname"} placeholder={placeholder} required
            maxLength={field === "email" ? 254 : undefined} value={form[field]} disabled={submitting || checking[field]}
            onChange={(event) => change(field, event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, [field]: true }))}
            aria-invalid={Boolean(error || check.status === "unavailable" || check.status === "error")}
            aria-describedby={message ? `signup-${field}-message` : undefined} />
          <button className="secondary-button" type="button" disabled={Boolean(errors[field]) || checking[field] || submitting}
            onClick={() => void checkDuplicate(field)} aria-label={`${label} 중복 확인`}>
            {checking[field] ? "확인 중…" : "중복 확인"}
          </button>
        </div>
        {message && <p id={`signup-${field}-message`} className={!error && check.status === "available" ? "field-success" : "field-error"} role="status">{message}</p>}
      </div>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-heading">
        <h1 id="signup-heading" className="auth-heading">회원가입</h1>
        <p className="auth-description">나만의 영화 이야기를 시작해 보세요.</p>
        {registered ? (
          <div className="auth-form">
            <p className="form-feedback" role="status">{feedback}</p>
            <Link className="primary-button" to="/login">로그인하러 가기</Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={(event) => void handleSubmit(event)} noValidate aria-busy={submitting}>
            {duplicateField("email", "이메일", "이메일을 입력해 주세요")}
            {duplicateField("nickname", "닉네임", "2~12자의 닉네임을 입력해 주세요")}
            <div className="form-field">
              <label className="field-label" htmlFor="signup-password">비밀번호</label>
              <input id="signup-password" name="password" className="field-input" type="password" autoComplete="new-password" placeholder="비밀번호를 입력해 주세요"
                required value={form.password} disabled={submitting} onChange={(event) => change("password", event.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                aria-invalid={Boolean((touched.password || form.password.length > 0) && errors.password)} aria-describedby="signup-password-help" />
              <p id="signup-password-help" className={(touched.password || form.password.length > 0) && errors.password ? "field-error" : "field-hint"} aria-live="polite">
                {(touched.password || form.password.length > 0) && errors.password ? errors.password : "대문자·소문자·숫자·특수문자(!@#$%^&*) 포함 8자 이상, 72바이트 이하"}
              </p>
            </div>
            <div className="form-field">
              <label className="field-label" htmlFor="signup-passwordConfirm">비밀번호 확인</label>
              <input id="signup-passwordConfirm" name="passwordConfirm" className="field-input" type="password" autoComplete="new-password" placeholder="비밀번호를 한 번 더 입력해 주세요"
                required value={form.passwordConfirm} disabled={submitting} onChange={(event) => change("passwordConfirm", event.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, passwordConfirm: true }))}
                aria-invalid={Boolean((touched.passwordConfirm || form.passwordConfirm.length > 0) && errors.passwordConfirm)} aria-describedby={(touched.passwordConfirm || form.passwordConfirm.length > 0) && errors.passwordConfirm ? "signup-confirm-error" : undefined} />
              {(touched.passwordConfirm || form.passwordConfirm.length > 0) && errors.passwordConfirm && <p id="signup-confirm-error" className="field-error" role="status">{errors.passwordConfirm}</p>}
            </div>
            {feedback && <p className="form-feedback" role="alert">{feedback}</p>}
            <button className="primary-button" type="submit" disabled={!canSubmit || submitting || checking.email || checking.nickname}>{submitting ? "가입 중…" : "가입하기"}</button>
          </form>
        )}
        <p className="auth-footer">이미 계정이 있으신가요? <Link to="/login">로그인</Link></p>
      </section>
    </main>
  );
}
