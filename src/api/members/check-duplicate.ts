import { apiClient, readApiResponse } from "../api-client";

type DuplicateResult = { exists: boolean };

// The existing server returns `exists`; the form needs the inverse `available`.
export async function checkEmailAvailable(email: string): Promise<boolean> {
  const response = await readApiResponse<DuplicateResult>(apiClient.get(`members/email/${encodeURIComponent(email.trim())}`));
  return response.result.exists === false;
}

export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  const response = await readApiResponse<DuplicateResult>(apiClient.get(`members/nickname/${encodeURIComponent(nickname.trim())}`));
  return response.result.exists === false;
}
