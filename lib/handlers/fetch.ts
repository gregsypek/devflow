import { RequestError } from "../http-errors";
import logger from "../logger";
import handleError from "./error";

// The RequestInit dictionary of the Fetch API represents the set of options that can be used to configure a fetch request. https://developer.mozilla.org/en-US/docs/Web/API/RequestInit
interface FetchOptions extends RequestInit {
  timeout?: number;
}

// NOTE:
// Parametr error: unknown:

// Gdy obsługujemy wyjątki w catch, nie mamy gwarancji, że typ błędu jest zawsze instancją Error. Dlatego deklarujemy typ jako unknown – jest to najbardziej ogólny typ w TypeScript (oznacza, że nic o nim nie wiemy).
// Zwracanie error is Error:

// To specjalna składnia TypeScript.
// Mówi TypeScriptowi, że jeśli funkcja zwróci true, to zmienna error można traktować jako typ Error w dalszym kodzie.
// instanceof Error:

// Sprawdza, czy error jest instancją klasy Error.
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export async function fetchHandler<T>(
  url: string,
  options: FetchOptions = {}
): Promise<ActionResponse<T>> {
  const {
    timeout = 100000,
    headers: customHeaders = {},
    ...restOptions
  } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const headers: HeadersInit = { ...defaultHeaders, ...customHeaders };
  const config: RequestInit = {
    ...restOptions,
    headers,
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(id);

    if (!response.ok) {
      throw new RequestError(response.status, `HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    const error = isError(err) ? err : new Error("Unknown error");
    if (error.name === "AbortError") {
      logger.warn(`Request to ${url} timed out`);
    } else {
      logger.error(`Error fetching ${url}: ${error.message}`);
    }

    return handleError(error) as ActionResponse<T>;
  }
}
