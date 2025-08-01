export type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

export type TargetCss = {
  id: string
  css?: string
}
