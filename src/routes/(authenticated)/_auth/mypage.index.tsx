import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "../../../pages/member/profile-page";

export const Route = createFileRoute("/(authenticated)/_auth/mypage/")({ component: ProfilePage });
