import { type FontFallback, FontFallbacks } from '@/core/font-fallback'
import { buildFallbackDefinition, buildFontClassRules } from '@/core/stylesheet'
import type { FontCssProperties } from '@/core/util'

// Equivalent of Rust's `build_stylesheet`
export const buildStylesheet = async (
  baseStylesheet: string | null,
  fontCssProperties: FontCssProperties,
  fontFallback: FontFallback
): Promise<string> => {
  let stylesheet = baseStylesheet ?? ''

  stylesheet += await buildFallbackDefinition(new FontFallbacks([fontFallback]))
  stylesheet += await buildFontClassRules(fontCssProperties)

  return stylesheet
}
