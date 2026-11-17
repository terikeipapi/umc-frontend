import { authenticatedApiClient, readApiResponse } from "../api-client";

export interface MemberProfile {
  email: string;
  nickname: string;
  createdAt: string;
}

export async function getMyProfile(signal?: AbortSignal): Promise<MemberProfile> {
  return (await readApiResponse<MemberProfile>(authenticatedApiClient.get("members/me", { signal }))).result;
}

export async function updateMyProfile(nickname: string): Promise<MemberProfile> {
  return (await readApiResponse<MemberProfile>(authenticatedApiClient.patch("members/me", {
    json: { nickname: nickname.trim() },
  }))).result;
}
