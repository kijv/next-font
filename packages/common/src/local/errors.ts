export type FontResult<T> = T | FontFileNotFound

export class FontFileNotFound {
  constructor(public readonly field0: string) {}

  toString() {
    return `Font file not found: Can't resolve ${this.field0}`
  }
}
