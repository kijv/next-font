export interface DefaultFallbackFont {
  name: string
  capsizeKey: string
  azAvgWidth: number
  unitsPerEm: number
}

export const DEFAULT_SANS_SERIF_FONT: DefaultFallbackFont = {
  name: 'Arial',
  capsizeKey: 'arial',
  azAvgWidth: 934.5116279069767,
  unitsPerEm: 2048,
}

export const DEFAULT_SERIF_FONT: DefaultFallbackFont = {
  name: 'Times New Roman',
  capsizeKey: 'timesNewRoman',
  azAvgWidth: 854.3953488372093,
  unitsPerEm: 2048,
}

export interface FontAdjustment {
  ascent: number
  descent: number
  lineGap: number
  sizeAdjust: number
}

export interface AutomaticFontFallback {
  scopedFontFamily: string
  localFontFamily: string
  adjustment?: FontAdjustment
}

export type FontFallback =
  | { type: 'automatic'; value: AutomaticFontFallback }
  | { type: 'error' }
  | { type: 'manual'; value: string[] }

export const hasSizeAdjust = (fallback: FontFallback): boolean =>
  fallback.type === 'automatic' && fallback.value.adjustment !== undefined

export class FontFallbacks {
  constructor(public fallbacks: FontFallback[]) {}

  hasSizeAdjust = (): boolean => this.fallbacks.some(hasSizeAdjust)
}
