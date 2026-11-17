import { ApiError } from "../api/api-client";
import { getSession } from "../store/auth-store";

export function requireMemberSession(memberId: number | null, accessToken?: string | null) {
  const session = getSession();
  if (!session || session.memberId !== memberId || (accessToken !== undefined && session.accessToken !== accessToken)) {
    throw new ApiError("로그인이 필요하거나 계정이 변경됐어요. 다시 로그인해 주세요.", "SESSION_CHANGED", 401);
  }
  return session;
}

export function getMemberErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요. 다시 시도해 주세요.";
}
