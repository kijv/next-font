export type StringOrRegExp = string | RegExp
export type MaybeArray<T> = T | T[]
export type MaybePromise<T> = T | Promise<T>
export type NullValue<T = void> = T | undefined | null | void
export type Optionify<T> = MaybePromise<
  | NullValue<T>
  | {
      name: string
    }
  | false
  | Optionify<T>[]
>

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never

type UnionLast<U> =
  UnionToIntersection<U extends any ? (x: U) => void : never> extends (
    x: infer L
  ) => void
    ? L
    : never

type UnionToTuple<U, Acc extends any[] = []> = [U] extends [never]
  ? Acc
  : UnionToTuple<Exclude<U, UnionLast<U>>, [UnionLast<U>, ...Acc]>

type TupleToUnion<T extends readonly any[]> = T[number]

type IsExactly<T, E> = [T] extends [E]
  ? [E] extends [T]
    ? true
    : false
  : false

type FilterTupleExclude<T extends any[], E> = T extends [
  infer Head,
  ...infer Tail,
]
  ? IsExactly<Head, E> extends true
    ? FilterTupleExclude<Tail, E>
    : [Head, ...FilterTupleExclude<Tail, E>]
  : []

export type ExcludeViaTuple<U, E> = TupleToUnion<
  FilterTupleExclude<UnionToTuple<U>, E>
>

export type DeepMutable<T> =
  // Handle functions as-is
  T extends (...args: any) => any
    ? T
    : // Handle arrays and tuples (including readonly ones)
      T extends readonly (infer U)[]
      ? DeepMutable<U>[]
      : // Handle objects
        T extends object
        ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
        : // Primitives and everything else stay as-is
          T
