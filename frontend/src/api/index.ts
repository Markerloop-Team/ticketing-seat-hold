import { createHttpApi } from "./http";

export * from "./types";

export const api = createHttpApi(import.meta.env.VITE_API_URL ?? "/api");
