// The member API is separate from TMDB and uses the local NestJS server by default.
export const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "")}/`;
