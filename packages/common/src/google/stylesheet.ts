import { type FontFallback, FontFallbacks } from '../font-fallback'
import { buildFallbackDefinition, buildFontClassRules } from '../stylesheet'
import type { FontCssProperties } from '../util'

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
