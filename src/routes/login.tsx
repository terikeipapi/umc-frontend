import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "../pages/auth/login-page";
import { getSafeRedirect } from "../lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: search.redirect === undefined ? undefined : getSafeRedirect(search.redirect),
  }),
  component: LoginPage,
});
