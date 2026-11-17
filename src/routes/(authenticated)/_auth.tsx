import { createFileRoute, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { getSafeRedirect, requireAuth } from "../../lib/auth";
import { useAuthStore } from "../../store/auth-store";

export function AuthenticatedLayout() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const location = useLocation();
  if (!accessToken) return <Navigate to="/login" search={{ redirect: getSafeRedirect(location.href) }} replace />;
  return <Outlet />;
}

export const Route = createFileRoute("/(authenticated)/_auth")({
  beforeLoad: ({ location }) => { requireAuth(location); },
  component: AuthenticatedLayout,
});
