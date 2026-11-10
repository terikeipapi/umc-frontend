import { apiClient, readApiResponse } from "../api-client";

export interface SignupRequest {
  email: string;
  nickname: string;
  password: string;
}

export interface SignupMember {
  memberId: number;
  email: string;
  nickname: string;
}

export function signup(input: SignupRequest) {
  // Confirmation is local validation only and is never sent to the server.
  const payload: SignupRequest = { email: input.email.trim(), nickname: input.nickname.trim(), password: input.password };
  return readApiResponse<SignupMember>(apiClient.post("members", { json: payload }));
}
