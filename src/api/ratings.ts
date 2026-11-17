import { authenticatedApiClient, readApiResponse } from "./api-client";

export interface Rating {
  ratingId: number;
  memberId: number;
  movieId: number;
  score: number;
  comment: string | null;
}

export interface RatingInput { score: number; comment?: string | null }
export interface CreateRatingInput extends RatingInput { movieId: number }

export async function getMemberRatings(memberId: number, signal?: AbortSignal) {
  return (await readApiResponse<Rating[]>(authenticatedApiClient.get(`members/${memberId}/ratings`, { signal }))).result;
}

export async function createRating(input: CreateRatingInput) {
  const { movieId, score, comment } = input;
  return (await readApiResponse<Rating>(authenticatedApiClient.post("ratings", { json: { movieId, score, comment: comment?.trim() || null } }))).result;
}

export async function updateRating(ratingId: number, input: RatingInput) {
  const { score, comment } = input;
  return (await readApiResponse<Rating>(authenticatedApiClient.patch(`ratings/${ratingId}`, { json: { score, comment: comment?.trim() || null } }))).result;
}

export async function deleteRating(ratingId: number) {
  await readApiResponse<null>(authenticatedApiClient.delete(`ratings/${ratingId}`));
}
