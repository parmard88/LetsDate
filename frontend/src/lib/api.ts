const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
}

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T extends ApiResponse>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(
      "Unable to connect to the server. Please check that the backend is running.",
    );
  }

  const data = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || "Something went wrong. Please try again.",
      response.status,
    );
  }

  return data;
}