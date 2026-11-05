import { ApiError } from "@/types/api";
import { sessionService } from "@/services/session";

const API_BASE_URL = (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_BASE_URL) || "http://10.0.2.2:3001";

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

/**
 * Internal fetch wrapper used by all API calls.
 * Automatically attaches the HttpOnly session cookie (letsdate_session)
 * stored in AsyncStorage to every request.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers as Record<string, string>);

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach session cookie from AsyncStorage
  const cookieHeader = await sessionService.getCookieHeader();
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Unable to connect to the server. Please check that the backend is running."
    );
  }

  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;

    // On 401, clear the stored session so the auth gate can redirect
    if (response.status === 401) {
      await sessionService.clearToken();
    }

    throw new ApiError(
      errorData.message ||
        errorData.error ||
        "Something went wrong. Please try again.",
      response.status
    );
  }

  return data as T;
}

export { API_BASE_URL };
