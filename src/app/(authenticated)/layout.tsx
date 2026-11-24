import { Suspense, type ReactNode } from "react";
import { AuthGuard } from "../../components/auth/auth-guard";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main role="status">로그인 상태를 확인하고 있어요.</main>}><AuthGuard>{children}</AuthGuard></Suspense>;
}
