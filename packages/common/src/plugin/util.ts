export const createCachedImport = <T>(
  imp: () => Promise<T>
): (() => T | Promise<T>) => {
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

// Splits the path into two components:
// 1. The path without the extension;
// 2. The extension, if any.
export function splitExtension(
  path: string
): [string, string | null | undefined] {
  const index = path.lastIndexOf('.')
  const [pathBeforeExtension, extension] =
    index !== -1 ? [path.slice(0, index), path.slice(index + 1)] : [null, null]
  if (pathBeforeExtension != null && extension != null) {
    if (
      extension?.includes('/') ||
      pathBeforeExtension.endsWith('/') ||
      pathBeforeExtension?.length === 0
    ) {
      // The file name begins with a `.` and has no other `.`s within.
      return [path, null]
    } else {
      return [pathBeforeExtension, extension]
    }
  }
  return [path, null]
}

// https://datatracker.ietf.org/doc/html/rfc2396
// eslint-disable-next-line no-control-regex
const INVALID_CHAR_REGEX = /[\u0000-\u001F"#$%&*+,:;<=>?[\]^`{|}\u007F]/g
const DRIVE_LETTER_REGEX = /^[a-z]:/i

export function sanitizeFileName(name: string): string {
  const match = DRIVE_LETTER_REGEX.exec(name)
  const driveLetter = match ? match[0] : ''

  // A `:` is only allowed as part of a windows drive letter (ex: C:\foo)
  // Otherwise, avoid them because they can refer to NTFS alternate data streams.
  return (
    driveLetter +
    name.slice(driveLetter.length).replace(INVALID_CHAR_REGEX, '_')
  )
}

const windowsSlashRE = /\\/g
export function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}

const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function arraify<T>(target: T | T[]): T[] {
  return Array.isArray(target) ? target : [target]
}

type AsyncFlatten<T extends unknown[]> = T extends (infer U)[]
  ? Exclude<Awaited<U>, U[]>[]
  : never

export async function asyncFlatten<T extends unknown[]>(
  arr: T
): Promise<AsyncFlatten<T>> {
  do {
    // oxlint-disable no-await-in-loop
    arr = (await Promise.all(arr)).flat(Infinity) as any
  } while (arr.some((v: any) => v?.then))
  return arr as unknown[] as AsyncFlatten<T>
}

type Flatten<T extends unknown[]> = T extends (infer U)[]
  ? Exclude<U, U[]>[]
  : never

export function flatten<T extends unknown[]>(target: T): Flatten<T> {
  return target.flat(Infinity) as unknown[] as Flatten<T>
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  if (value === null) return false

  const t = typeof value
  if (t !== 'object' && t !== 'function') return false

  const then = (value as any).then
  return typeof then === 'function'
}
