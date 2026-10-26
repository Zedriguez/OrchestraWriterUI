import { mockApi } from "./mock";
import type { ApiClient } from "./types";

/** Swap for the HTTP client once the AWS services exist. */
export const api: ApiClient = mockApi;
export type { ApiClient, ExportMp4Options } from "./types";
