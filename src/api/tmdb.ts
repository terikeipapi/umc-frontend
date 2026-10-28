import ky from "ky";
import { getTmdbAuth, TMDB_API_URL } from "./tmdb-config";

// ky v1 uses prefixUrl; endpoint paths must not start with a slash.
export const tmdb = ky.create({
  prefixUrl: TMDB_API_URL,
  timeout: 10_000,
  retry: 0,
  headers: { accept: "application/json" },
  hooks: {
    beforeRequest: [
      (request) => {
        const auth = getTmdbAuth();
        for (const [key, value] of Object.entries(auth.headers)) request.headers.set(key, value);
        const url = new URL(request.url);
        for (const [key, value] of Object.entries(auth.searchParams)) {
          if (value) url.searchParams.set(key, value);
        }
        return new Request(url, request);
      },
    ],
  },
});
