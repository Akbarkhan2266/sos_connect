import axios from "axios";

const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:4005";

// Authentication is handled exclusively by the HTTP-only access_token cookie.
// withCredentials sends that cookie to each local backend service; no JWT is exposed to JavaScript.
export const userApi = axios.create({ baseURL: `${"http://localhost:4000"}`, withCredentials: true });
export const sosApi = axios.create({ baseURL: `${"http://localhost:4001"}`, withCredentials: true });

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || fallback;
  }
  return fallback;
}
