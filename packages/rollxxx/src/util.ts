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
