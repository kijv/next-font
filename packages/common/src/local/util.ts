import type { FontFallbacks } from '../font-fallback'
import type { NextFontLocalOptions } from './options'
import { getScopedFontFamily } from '../util'

export function buildFontFamilyString(
  { variableName: fontFamily }: NextFontLocalOptions,
  fontFallbacks: FontFallbacks
): string {
  const fontFamilies: string[] = [
    `'${getScopedFontFamily('webFont', fontFamily)}'`,
  ]

  for (const fallback of fontFallbacks.fallbacks) {
    if (fallback.type === 'automatic') {
      fontFamilies.push(`'${fallback.value.scopedFontFamily}'`)
    } else if (fallback.type === 'manual') {
      fontFamilies.push(...fallback.value)
    }
  }

  return fontFamilies.join(', ')
}
