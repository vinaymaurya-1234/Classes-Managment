const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const TOKEN_KEY = "classleaf_auth_token";

async function request(path, options = {}, token = "") {
  let response;

  const authToken = token || localStorage.getItem(TOKEN_KEY);

  const authHeader = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw new Error(
      "Unable to connect to the backend. Make sure the API server is running.",
    );
  }

  const contentType = response.headers.get("content-type") || "";

  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  return response.status === 204 ? null : payload;
}

export const api = {
  get: (path, token) => request(path, {}, token),

  post: (path, body, token) =>
    request(
      path,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token,
    ),

  put: (path, body, token) =>
    request(
      path,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
      token,
    ),

  delete: (path, token) =>
    request(
      path,
      {
        method: "DELETE",
      },
      token,
    ),
};
