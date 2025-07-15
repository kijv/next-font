export const createCachedImport = <T>(imp: () => Promise<T>): (() => T | Promise<T>) => {
  let cached: T | Promise<T>
  return () => {
    if (!cached) {
      cached = imp().then((module) => {
        cached = module
        return module
      })
    }
    return cached
  }
}

// regexp is based on https://github.com/sindresorhus/escape-string-regexp
const reHasRegExp = /[|\\{}()[\]^$+*?.-]/
const reReplaceRegExp = /[|\\{}()[\]^$+*?.-]/g

export const escapeStringRegexp = (str: string) => {
  // see also: https://github.com/lodash/lodash/blob/2da024c3b4f9947a48517639de7560457cd4ec6c/escapeRegExp.js#L23
  if (reHasRegExp.test(str)) {
    return str.replace(reReplaceRegExp, '\\$&')
  }
  return str
}
