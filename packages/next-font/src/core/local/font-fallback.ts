import {
  DEFAULT_SANS_SERIF_FONT,
  DEFAULT_SERIF_FONT,
  type DefaultFallbackFont,
  type FontAdjustment,
  type FontFallback,
  FontFallbacks,
} from '../font-fallback'
import type {
  FontDescriptor,
  FontWeight,
  NextFontLocalOptions,
} from './options'
import { FontFileNotFound, type FontResult } from './errors'
import type { Font } from 'fontkit'
import { createCachedImport } from '@/plugin/util'
import fs from 'node:fs/promises'
import { getScopedFontFamily } from '../util'
import path from 'node:path'

const importFontkit = createCachedImport(() =>
  import('@/fontkit').then((mod) => mod.default)
)

export type FontFallbackResult = FontFallbacks | FontFileNotFound

const AVG_CHARACTERS = 'aaabcdeeeefghiijklmnnoopqrrssttuvwxyz      '
const NORMAL_WEIGHT = 400
const BOLD_WEIGHT = 700

export async function getFontFallback(
  lookupPath: string,
  options: NextFontLocalOptions
) {
  const scopedFontFamily = getScopedFontFamily('fallback', options.variableName)

  const fontFallbacks: FontFallback[] = []

  const adjustment =
    options.adjustFontFallback === 'Arial' ||
    options.adjustFontFallback === 'Times New Roman'
      ? await getFontAdjustment(
          lookupPath,
          options,
          options.adjustFontFallback === 'Arial'
            ? DEFAULT_SANS_SERIF_FONT
            : DEFAULT_SERIF_FONT
        )
      : null

  if (adjustment instanceof FontFileNotFound) {
    return adjustment
  }

  if (adjustment != null) {
    fontFallbacks.push({
      type: 'automatic',
      value: {
        scopedFontFamily,
        localFontFamily:
          options.adjustFontFallback === 'Arial' ? 'Arial' : 'Times New Roman',
        adjustment,
      },
    })
  }

  if (options.fallback != null) {
    fontFallbacks.push({ type: 'manual', value: options.fallback })
  }

  return new FontFallbacks(fontFallbacks)
}

async function getFontAdjustment(
  lookupPath: string,
  options: NextFontLocalOptions,
  fallbackFont: DefaultFallbackFont
): Promise<FontResult<FontAdjustment>> {
  const mainDescriptor = pickFontFileForFallbackGeneration(options.fonts)
  const fontFile = await fs
    .readFile(path.join(lookupPath, mainDescriptor.path))
    .catch(() => null)

  if (!fontFile) {
    return new FontFileNotFound(mainDescriptor.path)
  }

  const fontFromBuffer = await importFontkit()
  const font = await (async () => {
    const result = fontFromBuffer(Buffer.from(fontFile.buffer))
    return 'fonts' in result ? result.fonts[0] : result
  })().catch(() => null)
  if (!font) {
    throw new Error(
      `"Unable to read font metrics from font file at ${mainDescriptor.path}"`
    )
  }

  const xWidthAvg = calcXWidthAvg(font)
  const { unitsPerEm } = font

  const fallbackAvgWidth = fallbackFont.azAvgWidth / fallbackFont.unitsPerEm
  const sizeAdjust = xWidthAvg ? xWidthAvg / fallbackAvgWidth : 1

  return {
    ascent: font.ascent / (unitsPerEm * sizeAdjust),
    descent: font.descent / (unitsPerEm * sizeAdjust),
    lineGap: font.lineGap / (unitsPerEm * sizeAdjust),
    sizeAdjust,
  }
}

// oxlint-disable no-unused-vars
function calcAverageWidth(font: Font): number | undefined {
  try {
    const hasAllGlyphs = font
      .glyphsForString(AVG_CHARACTERS)
      .flatMap((glyph) => glyph.codePoints)
      .every((codePoint) => font.hasGlyphForCodePoint(codePoint))
    if (!hasAllGlyphs) return

    const widths = font
      .glyphsForString(AVG_CHARACTERS)
      .map((glyph) => glyph.advanceWidth)
    return widths.reduce((sum, width) => sum + width, 0) / widths.length
  } catch {
    return
  }
}

export function pickFontFileForFallbackGeneration(
  fontDescriptors: FontDescriptor | FontDescriptor[]
): FontDescriptor {
  if (!Array.isArray(fontDescriptors)) return fontDescriptors

  const iter = fontDescriptors.values()
  let usedDescriptor = iter.next().value
  if (!usedDescriptor) throw new Error('At least one font is required')

  for (const currentDescriptor of iter) {
    const usedFontDistance = getDistanceFromNormalWeight(usedDescriptor.weight)
    const currentFontDistance = getDistanceFromNormalWeight(
      currentDescriptor.weight
    )

    // Prefer normal style if they have the same weight
    if (
      usedFontDistance === currentFontDistance &&
      currentDescriptor.style !== 'italic'
    ) {
      usedDescriptor = currentDescriptor
      continue
    }

    const absUsedDistance = Math.abs(usedFontDistance)
    const absCurrentDistance = Math.abs(currentFontDistance)

    // Use closest absolute distance to normal weight
    if (absCurrentDistance < absUsedDistance) {
      usedDescriptor = currentDescriptor
      continue
    }

    // Prefer the thinner font if both have the same absolute distance
    if (
      absCurrentDistance === absUsedDistance &&
      currentFontDistance < usedFontDistance
    ) {
      usedDescriptor = currentDescriptor
      continue
    }
  }

  return usedDescriptor
}

function getDistanceFromNormalWeight(weight?: FontWeight): number {
  if (!weight) return 0

  return weight.type === 'fixed'
    ? parseWeightString(weight.value) - NORMAL_WEIGHT
    : (() => {
        const start = parseWeightString(weight.start)
        const end = parseWeightString(weight.end)

        // Normal weight is within variable font range
        if (NORMAL_WEIGHT > start && NORMAL_WEIGHT < end) {
          return 0
        }

        const startDistance = start - NORMAL_WEIGHT
        const endDistance = end - NORMAL_WEIGHT

        if (Math.abs(startDistance) < Math.abs(endDistance)) {
          return startDistance
        }
        return endDistance
      })()
}

function parseWeightString(weightStr: string): number {
  if (weightStr === 'normal') {
    return NORMAL_WEIGHT
  } else if (weightStr === 'bold') {
    return BOLD_WEIGHT
  } else {
    const weight = Number(weightStr)
    if (Number.isNaN(weight)) {
      throw new Error(
        `Invalid weight value in src array: \`${weightStr}\`. Expected \`normal\`, \`bold\` or a number.`
      )
    }
    return weight
  }
}

// https://github.com/seek-oss/capsize/blob/42d6dc39d58247bc6b9e013a4b1c4463bf287dca/packages/unpack/src/index.ts#L7-L83
const WEIGHTINGS = {
  a: 0.0668,
  b: 0.0122,
  c: 0.0228,
  d: 0.0348,
  e: 0.1039,
  f: 0.0182,
  g: 0.0165,
  h: 0.0499,
  i: 0.057,
  j: 0.0013,
  k: 0.0063,
  l: 0.0329,
  m: 0.0197,
  n: 0.0552,
  o: 0.0614,
  p: 0.0158,
  q: 0.0008,
  r: 0.049,
  s: 0.0518,
  t: 0.0741,
  u: 0.0226,
  v: 0.008,
  w: 0.0193,
  x: 0.0012,
  y: 0.0162,
  z: 0.0006,
  ' ': 0.1818,
} as const
const WEIGHTING_SAMPLE_STRING = Object.keys(WEIGHTINGS).join('')
const weightingForCharacter = (character: string) => {
  if (!Object.keys(WEIGHTINGS).includes(character)) {
    throw new Error(`No weighting specified for character: “${character}”`)
  }
  return WEIGHTINGS[character as keyof typeof WEIGHTINGS]
}
function calcXWidthAvg(font: Font): number {
  const { familyName } = font

  const glyphs = font.glyphsForString(WEIGHTING_SAMPLE_STRING)
  const weightedWidth = glyphs.reduce((sum, glyph, index) => {
    const character = WEIGHTING_SAMPLE_STRING.charAt(index)

    let charWidth = font['OS/2'].xAvgCharWidth
    try {
      charWidth = glyph.advanceWidth
    } catch {
      console.warn(
        `Couldn’t read 'advanceWidth' for character “${
          character === ' ' ? '<space>' : character
        }” from “${familyName}”. Falling back to “xAvgCharWidth”.`
      )
    }

    return sum + charWidth * weightingForCharacter(character)
  }, 0)

  return Math.round(weightedWidth)
}
