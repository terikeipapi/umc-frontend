import { apiClient, readApiResponse } from "./api-client";

export interface LoginResult {
  nickname: string;
  accessToken: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await readApiResponse<LoginResult>(apiClient.post("auth/login", {
    json: { email: email.trim(), password },
  }));
  return response.result;
}
