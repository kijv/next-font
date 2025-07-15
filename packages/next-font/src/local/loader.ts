import fs from 'node:fs/promises'
import type { Font, FontCollection } from 'fontkit'
import type { AdjustFontFallback, FontLoader } from '../declarations'
import { createCachedImport } from '../utils'

// @ts-expect-error treated as external (bunchee)
import { validateLocalFontFunctionCall } from './validate-local-font-function-call.js'

const importGetFallbackMetricsFromFontFile = createCachedImport<
  typeof import('../../dist/local/get-fallback-metrics-from-font-file')
>(() =>
  // @ts-expect-error treated as external (bunchee)
  import('./get-fallback-metrics-from-font-file.js').then((mod) => mod.default || mod)
)

const importPickFontFileForFallbackGeneration = createCachedImport<
  typeof import('../../dist/local/pick-font-file-for-fallback-generation')
>(() =>
  // @ts-expect-error treated as external (bunchee)
  import('./pick-font-file-for-fallback-generation.js').then((mod) => mod.default || mod)
)

const importFontkit = createCachedImport(() =>
  import('../fontkit').then((mod) => mod.default || mod)
)

const loader: FontLoader = async ({
  functionName,
  variableName,
  data,
  emitFontFile,
  resolve,
  loaderContext: ctx,
}) => {
  const {
    src,
    display,
    fallback,
    preload,
    variable,
    adjustFontFallback,
    declarations,
    weight: defaultWeight,
    style: defaultStyle,
  } = (
    validateLocalFontFunctionCall as typeof import('../../dist/local/validate-local-font-function-call')['validateLocalFontFunctionCall']
  )(functionName, data[0])

  // Load all font files and emit them to the .next output directory
  // Also generate a @font-face CSS for each font file
  const fontFiles = await Promise.all(
    src.map(async ({ path, style, weight, ext, format }) => {
      const resolved = resolve(path)
      const fileBuffer = Buffer.from(await (ctx.fs ?? fs).readFile(resolved))
      const fontUrl = emitFontFile(
        fileBuffer,
        ext,
        preload,
        typeof adjustFontFallback === 'undefined' || !!adjustFontFallback
      )

      const fontFromBuffer = await importFontkit()

      // Try to load font metadata from the font file using fontkit.
      // The data is used to calculate the fallback font override values.
      let fontMetadata: Font | FontCollection | undefined
      try {
        fontMetadata = fontFromBuffer(fileBuffer)
      } catch (e) {
        console.error(`Failed to load font file: ${resolved}\n${e}`)
      }

      // Check if `font-family` is explicitly defined in `declarations`
      const hasCustomFontFamily = declarations?.some(({ prop }) => prop === 'font-family')

      // Get all values that should be added to the @font-face declaration
      const fontFaceProperties = [
        ...(declarations ? declarations.map(({ prop, value }) => [prop, value]) : []),
        ...(hasCustomFontFamily ? [] : [['font-family', variableName]]),
        ['src', `url(${fontUrl}) format('${format}')`],
        ['font-display', display],
        ...((weight ?? defaultWeight) ? [['font-weight', weight ?? defaultWeight]] : []),
        ...((style ?? defaultStyle) ? [['font-style', style ?? defaultStyle]] : []),
      ]

      // Generate the @font-face CSS from the font-face properties
      const css = `@font-face {\n${fontFaceProperties
        .map(([property, value]) => `${property}: ${value};`)
        .join('\n')}\n}\n`

      return {
        css,
        fontMetadata,
        weight,
        style,
      }
    })
  )

  // Calculate the fallback font override values using the font file metadata
  let adjustFontFallbackMetrics: AdjustFontFallback | undefined
  if (adjustFontFallback !== false) {
    const { pickFontFileForFallbackGeneration } = await importPickFontFileForFallbackGeneration()
    const fallbackFontFile = pickFontFileForFallbackGeneration(fontFiles)
    if (fallbackFontFile.fontMetadata) {
      const { getFallbackMetricsFromFontFile } = await importGetFallbackMetricsFromFontFile()
      adjustFontFallbackMetrics = getFallbackMetricsFromFontFile(
        fallbackFontFile.fontMetadata as Font,
        adjustFontFallback === 'Times New Roman' ? 'serif' : 'sans-serif'
      )
    }
  }

  return {
    css: fontFiles.map(({ css }) => css).join('\n'),
    fallbackFonts: fallback,
    weight: src.length === 1 ? src[0]!.weight : undefined,
    style: src.length === 1 ? src[0]!.style : undefined,
    variable,
    adjustFontFallback: adjustFontFallbackMetrics,
  }
}

export default loader
