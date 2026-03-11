import type { FontFallback } from '@/core/font-fallback'
import type { NextFontGoogleOptions } from './options'
import { createCachedImport } from '@/plugin/util'
import { getScopedFontFamily } from '@/core/util'

type FontAdjustment = {
  ascent: number
  descent: number
  lineGap: number
  sizeAdjust: number
}

type FontMetricsMapEntry = {
  familyName: string
  category: string
  capHeight?: number
  ascent: number
  descent?: number
  lineGap: number
  unitsPerEm: number
  xHeight?: number
  xWidthAvg: number
}

export type FontMetricsMap = Record<string, FontMetricsMapEntry>

export type Fallback = {
  fontFamily: string
  adjustment?: FontAdjustment
}

const DEFAULT_SERIF_FONT = {
  name: 'Times New Roman',
  capsizeKey: 'timesNewRoman',
}
const DEFAULT_SANS_SERIF_FONT = { name: 'Arial', capsizeKey: 'arial' }

const formatFallbackFontName = (fontFamily: string): string => {
  return fontFamily
    .replace(/\b\w/g, (c, i) => (i === 0 ? c.toLowerCase() : c.toUpperCase()))
    .replace(/\s+/g, '')
}

export const lookupFallback = (
  fontFamily: string,
  fontMetricsMap: FontMetricsMap,
  adjust: boolean
): Fallback => {
  const key = formatFallbackFontName(fontFamily)
  const metrics = fontMetricsMap[key]
  if (!metrics) throw new Error('Font not found in metrics')

  const fallback =
    metrics.category === 'serif' ? DEFAULT_SERIF_FONT : DEFAULT_SANS_SERIF_FONT

  let adjustment: FontAdjustment | undefined
  if (adjust) {
    const mainFontAvgWidth = metrics.xWidthAvg / metrics.unitsPerEm
    const fallbackMetrics = fontMetricsMap[fallback.capsizeKey]
    if (!fallbackMetrics)
      throw new Error(`Fallback font metrics missing: ${fallback.name}`)
    const fallbackFontAvgWidth =
      fallbackMetrics.xWidthAvg / fallbackMetrics.unitsPerEm
    const sizeAdjust = mainFontAvgWidth / fallbackFontAvgWidth

    adjustment = {
      ascent: metrics.ascent / (metrics.unitsPerEm * sizeAdjust),
      descent: (metrics.descent ?? 0) / (metrics.unitsPerEm * sizeAdjust),
      lineGap: metrics.lineGap / (metrics.unitsPerEm * sizeAdjust),
      sizeAdjust,
    }
  }

  return {
    fontFamily: fallback.name,
    adjustment,
  }
}

const loadFontMetrics = createCachedImport(async () =>
  import('next/dist/server/capsize-font-metrics.json').then(
    (mod) =>
      mod.default as typeof import('@capsizecss/metrics/entireMetricsCollection').entireMetricsCollection
  )
)

export const getFontFallback = async (
  options: NextFontGoogleOptions
): Promise<FontFallback> => {
  if (options.fallback) {
    return { type: 'manual', value: options.fallback }
  }

  const metricsJson = await loadFontMetrics()

  try {
    const fallback = lookupFallback(
      options.fontFamily,
      metricsJson,
      options.adjustFontFallback
    )
    return {
      type: 'automatic',
      value: {
        scopedFontFamily: getScopedFontFamily('fallback', options.fontFamily),
        localFontFamily: fallback.fontFamily,
        adjustment: fallback.adjustment,
      },
    }
  } catch {
    console.error(
      `Failed to find font override values for font ${options.fontFamily}. Skipping generating a fallback font.`
    )
    return { type: 'error' }
  }
}
