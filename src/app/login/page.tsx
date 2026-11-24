import { Suspense } from "react";
import { LoginPage } from "../../features/auth/login-page";

export default function LoginRoute() {
  return <Suspense fallback={<main role="status">로그인 화면을 불러오고 있어요.</main>}><LoginPage /></Suspense>;
}
