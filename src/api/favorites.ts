import { authenticatedApiClient, readApiResponse } from "./api-client";

export interface Favorite { movieId: number }
export interface FavoriteStatus extends Favorite { isFavorite: boolean }

export async function getFavorites(signal?: AbortSignal) {
  return (await readApiResponse<Favorite[]>(authenticatedApiClient.get("favorites", { signal }))).result;
}

export async function getFavorite(movieId: number, signal?: AbortSignal) {
  return (await readApiResponse<FavoriteStatus>(authenticatedApiClient.get(`favorites/${movieId}`, { signal }))).result;
}

export async function addFavorite(movieId: number) {
  return (await readApiResponse<FavoriteStatus>(authenticatedApiClient.post("favorites", { json: { movieId } }))).result;
}

export async function deleteFavorite(movieId: number) {
  await readApiResponse<null>(authenticatedApiClient.delete(`favorites/${movieId}`));
}
