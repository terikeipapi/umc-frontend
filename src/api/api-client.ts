import ky, { HTTPError } from "ky";
import { API_BASE_URL } from "../config/env";

export interface ApiResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
}

export class ApiError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

// ky v1 requires relative endpoints without a leading slash when using prefixUrl.
export const apiClient = ky.create({
  prefixUrl: API_BASE_URL,
  timeout: 10_000,
  retry: 0,
  headers: { accept: "application/json" },
});

export async function readApiResponse<T>(request: PromiseLike<Response>): Promise<ApiResponse<T>> {
  try {
    const response = await request;
    const body = await response.json() as ApiResponse<T>;
    if (!body || typeof body.isSuccess !== "boolean" || typeof body.message !== "string") {
      throw new ApiError("서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    if (!body.isSuccess) throw new ApiError(body.message, body.code, response.status);
    return body;
  } catch (error) {
    if (error instanceof HTTPError) {
      const body: unknown = await error.response.clone().json().catch(() => null);
      if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
        throw new ApiError(body.message, "code" in body && typeof body.code === "string" ? body.code : undefined, error.response.status);
      }
      throw new ApiError("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", undefined, error.response.status);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("서버에 연결하지 못했어요. 네트워크와 서버 실행 상태를 확인해 주세요.");
  }
}
