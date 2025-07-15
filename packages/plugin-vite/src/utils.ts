import queryString from 'query-string';
import type { ResolvedConfig } from 'vite';

export const getQuerySuffix = (id: string) => {
  const queryStart = id.indexOf('?');
  if (queryStart === -1) {
    return '';
  }
  return id.slice(queryStart);
};

export const removeQuerySuffix = (id: string) => {
  const queryStart = id.indexOf('?');
  if (queryStart === -1) {
    return id;
  }
  return id.slice(0, queryStart);
};

// regexp is based on https://github.com/sindresorhus/escape-string-regexp
const reHasRegExp = /[|\\{}()[\]^$+*?.-]/;
const reReplaceRegExp = /[|\\{}()[\]^$+*?.-]/g;

export const escapeStringRegexp = (str: string) => {
  // see also: https://github.com/lodash/lodash/blob/2da024c3b4f9947a48517639de7560457cd4ec6c/escapeRegExp.js#L23
  if (reHasRegExp.test(str)) {
    return str.replace(reReplaceRegExp, '\\$&');
  }
  return str;
};

export const createCachedImport = <T>(
  imp: () => Promise<T>,
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
  promise: Promise<T>,
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
  if (uri.startsWith('data:')) return uri;
  const filePath = cleanUrl(uri);
  const postfix = filePath !== uri ? uri.slice(filePath.length) : '';
  return encodeURI(filePath) + postfix;
}

const postfixRE = /[?#].*$/;
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '');
}

export const fontNameToUrl = (
  fontName: string,
) => {
  return [''].concat(['_next', fontName].filter(Boolean) as string[]).join('/');
};

export const normalizeTargetCssId = (id: string) => {
  return queryString.stringifyUrl({
    url: removeQuerySuffix(id),
    query: queryString.parse(
      getQuerySuffix(id),
    )
  });
};

export const isTargetCssId = (id: string) => {
  return /\.css(?:$|\?)/.test(id)
};