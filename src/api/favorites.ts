import { authenticatedApiClient, readApiResponse } from "./api-client";

export interface Favorite { movieId: number }
export interface FavoriteStatus extends Favorite { isFavorite: boolean }

export async function getFavorites(signal?: AbortSignal) {
  return (await readApiResponse<Favorite[]>(authenticatedApiClient.get("favorites", { signal }))).result;
}

export async function getFavorite(movieId: number, signal?: AbortSignal) {
  const result = (await readApiResponse<{ isFavorite: boolean }>(authenticatedApiClient.get(`favorites/${movieId}`, { signal }))).result;
  return { movieId, isFavorite: result.isFavorite };
}

export async function addFavorite(movieId: number) {
  await readApiResponse<Favorite>(authenticatedApiClient.post("favorites", { json: { movieId } }));
  return { movieId, isFavorite: true };
}

export async function deleteFavorite(movieId: number) {
  await readApiResponse<null>(authenticatedApiClient.delete(`favorites/${movieId}`));
}
