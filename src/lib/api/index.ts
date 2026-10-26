import { httpApi } from "./http";
import { mockApi } from "./mock";
import type { ApiClient } from "./types";

/**
 * `NEXT_PUBLIC_API_MOCK=1` swaps the HTTP client for the in-memory mock
 * (deterministic demo data, simulated jobs, no sign-in). Design review and
 * component tests run that way; everything else talks to the Hono API.
 */
export const API_MOCK = process.env.NEXT_PUBLIC_API_MOCK === "1";

export const api: ApiClient = API_MOCK ? mockApi : httpApi;
export type { ApiClient, ExportMp4Options } from "./types";
export { ApiRequestError, AuthRequiredError, onAuthRequired, errorMessage } from "./errors";
