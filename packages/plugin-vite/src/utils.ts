import nodeUrl from "node:url";
import path from "node:path";
import queryString from "query-string";

export const getQuerySuffix = (id: string) => {
  const queryStart = id.indexOf("?");
  if (queryStart === -1) {
    return "";
  }
  return id.slice(queryStart);
};

export const removeQuerySuffix = (id: string) => {
  const queryStart = id.indexOf("?");
  if (queryStart === -1) {
    return id;
  }
  return id.slice(0, queryStart);
};

export const createCachedImport = <T>(
  imp: () => Promise<T>
): (() => T | Promise<T>) => {
  let cached: T | Promise<T>;
  return () => {
    if (!cached) {
      cached = imp().then((module) => {
        cached = module;
        return module;
      });
    }
    return cached;
  };
};

// Types for the result object with discriminated union
type Success<T> = {
  data: T;
  error: null;
};

type Failure<E> = {
  data: null;
  error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

// Main wrapper function
export const tryCatch = async <T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> => {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
};

export const importResolve = async (id: string) =>
  import.meta.resolve(removeQuerySuffix(id));

/**
 * Encodes the URI path portion (ignores part after ? or #)
 */
export function encodeURIPath(uri: string): string {
  if (uri.startsWith("data:")) return uri;
  const filePath = cleanUrl(uri);
  const postfix = filePath !== uri ? uri.slice(filePath.length) : "";
  return encodeURI(filePath) + postfix;
}

const postfixRE = /[?#].*$/;
function cleanUrl(url: string): string {
  return url.replace(postfixRE, "");
}

export const createFontNameToUrl = (basePath = "") => {
  const correctedBasePath = basePath.endsWith("/")
    ? basePath.slice(0, -1)
    : basePath;
  return (fontName: string) => {
    return [correctedBasePath]
      .concat(["_next", fontName].filter(Boolean) as string[])
      .join("/");
  };
};

export const normalizeTargetCssId = (id: string) => {
  return queryString.stringifyUrl({
    url: removeQuerySuffix(id),
    query: pickKeys(queryString.parse(getQuerySuffix(id)), [
      "arguments",
      "path",
      "import",
      "variableName",
    ]),
  });
};

const pickKeys = <K extends string, V>(obj: Record<string, V>, keys: K[]) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => keys.includes(key as K))
  );
};

export const isWindows =
  typeof process !== "undefined" && process.platform === "win32";
const windowsSlashRE = /\\/g;
export function slash(p: string) {
  return p.replace(windowsSlashRE, "/");
}
export function normalizePath(id: string) {
  return path.posix.normalize(isWindows ? slash(id) : id);
}

export const fileUrlToPath = (url: string) => {
  let path = isFileUrl(url) ? nodeUrl.fileURLToPath(url) : url;
  if (isWindows) {
    path = path.replace(/^((\\|\/)?)[Cc]:/, "");
  }
  return path;
};

const isFileUrl = (url: string) => {
  try {
    const { protocol } = new URL(url);
    return protocol === "file:";
  } catch {
    return false;
  }
};

export const isSamePath = (a: string, b: string) => {
  const aPath = fileUrlToPath(a);
  const bPath = fileUrlToPath(b);

  return (
    aPath == bPath ||
    normalizePath(aPath) === normalizePath(bPath) ||
    encodeURIPath(normalizePath(aPath)) === encodeURIPath(normalizePath(bPath))
  );
};
