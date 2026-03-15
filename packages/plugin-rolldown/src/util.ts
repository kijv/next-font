export const nextJsFilePath = <const T extends string>(
  path: T
): `[next]_${T}` => `[next]_${path}`
