import type { AdjustFontFallback, FontLoader } from '../declarations'
import { createCachedImport, escapeStringRegexp } from '../utils'
// @ts-expect-error treated as external (bunchee)
import { nextFontError as _nextFontError } from '../next-font-error.js'
// @ts-expect-error treated as external (bunchee)
import { findFontFilesInCss } from './find-font-files-in-css.js'
// @ts-expect-error treated as external (bunchee)
import { getFontAxes } from './get-font-axes.js'
// @ts-expect-error treated as external (bunchee)
import { getGoogleFontsUrl } from './get-google-fonts-url.js'
// @ts-expect-error treated as external (bunchee)
import { validateGoogleFontFunctionCall } from './validate-google-font-function-call.js'

const nextFontError = _nextFontError as typeof import('../../dist/next-font-error')['nextFontError']

const importGetFallbackFontOverrideMetrics = createCachedImport<
  typeof import('../../dist/google/get-fallback-font-override-metrics')
>(() =>
  // @ts-expect-error treated as external (bunchee)
  import('./get-fallback-font-override-metrics.js').then((mod) => mod.default || mod)
)

const importFetchCSSFromGoogleFonts = createCachedImport<
  typeof import('../../dist/google/fetch-css-from-google-fonts')
>(() =>
  // @ts-expect-error treated as external (bunchee)
  import('./fetch-css-from-google-fonts.js').then((mod) => mod.default || mod)
)

const importFetchFontFile = createCachedImport<typeof import('../../dist/google/fetch-font-file')>(
  () =>
    // @ts-expect-error treated as external (bunchee)
    import('./fetch-font-file.js').then((mod) => mod.default || mod)
)

const loader: FontLoader = async ({
  functionName,
  data,
  emitFontFile,
  isDev,
  isServer,
  loaderContext: ctx,
  cache: { css: cssCache, font: fontCache } = {},
}) => {
  const {
    fontFamily,
    weights,
    styles,
    display,
    preload,
    selectedVariableAxes,
    fallback,
    adjustFontFallback,
    variable,
    subsets,
  } = (
    validateGoogleFontFunctionCall as typeof import('../../dist/google/validate-google-font-function-call')['validateGoogleFontFunctionCall']
  )(functionName, data[0])

  // Validate and get the font axes required to generated the URL
  const fontAxes = getFontAxes(fontFamily, weights, styles, selectedVariableAxes)

  // Generate the Google Fonts URL from the font family, axes and display value
  const url = getGoogleFontsUrl(fontFamily, fontAxes, display)

  // Get precalculated fallback font metrics, used to generate the fallback font CSS
  const adjustFontFallbackMetrics: AdjustFontFallback | undefined = adjustFontFallback
    ? await (async () => {
        const { getFallbackFontOverrideMetrics } = await importGetFallbackFontOverrideMetrics()
        return getFallbackFontOverrideMetrics(fontFamily)
      })()
    : undefined

  const result = {
    fallbackFonts: fallback,
    weight: weights.length === 1 && weights[0] !== 'variable' ? weights[0] : undefined,
    style: styles.length === 1 ? styles[0] : undefined,
    variable,
    adjustFontFallback: adjustFontFallbackMetrics,
  }

  try {
    /**
     * Hacky way to make sure the fetch is only done once.
     * Otherwise both the client and server compiler would fetch the CSS.
     * The reason we need to return the actual CSS from both the server and client is because a hash is generated based on the CSS content.
     */
    const hasCachedCSS = cssCache?.has(url)
    // Fetch CSS from Google Fonts or get it from the cache
    let fontFaceDeclarations =
      cssCache != null && hasCachedCSS
        ? cssCache.get(url)
        : await (async () => {
            const { fetchCSSFromGoogleFonts } = await importFetchCSSFromGoogleFonts()
            return await fetchCSSFromGoogleFonts(url, fontFamily, isDev).catch((err: Error) => {
              console.error(err)
              return null
            })
          })()
    if (!hasCachedCSS) {
      cssCache?.set(url, fontFaceDeclarations ?? null)
    } else {
      cssCache?.delete(url)
    }
    if (fontFaceDeclarations == null) {
      nextFontError(`Failed to fetch \`${fontFamily}\` from Google Fonts.`)
    }

    // CSS Variables may be set on a body tag, ignore them to keep the CSS module pure
    fontFaceDeclarations = fontFaceDeclarations!.split('body {', 1)[0]!

    // Find font files to download, provide the array of subsets we want to preload if preloading is enabled
    const fontFiles = (
      findFontFilesInCss as typeof import('../../dist/google/find-font-files-in-css')['findFontFilesInCss']
    )(fontFaceDeclarations, preload ? subsets : undefined)

    // Download the font files extracted from the CSS
    const downloadedFiles = await Promise.all(
      fontFiles.map(async ({ googleFontFileUrl, preloadFontFile }) => {
        const hasCachedFont = fontCache?.has(googleFontFileUrl)
        // Download the font file or get it from cache
        const fontFileBuffer =
          fontCache != null && hasCachedFont
            ? fontCache.get(googleFontFileUrl)
            : await (async () => {
                const { fetchFontFile } = await importFetchFontFile()
                return await fetchFontFile(googleFontFileUrl, isDev).catch((err: Error) => {
                  console.error(err)
                  return null
                })
              })()
        if (!hasCachedFont) {
          fontCache?.set(googleFontFileUrl, fontFileBuffer ?? null)
        } else {
          fontCache?.delete(googleFontFileUrl)
        }
        if (fontFileBuffer == null) {
          nextFontError(`Failed to fetch \`${fontFamily}\` from Google Fonts.`)
        }

        const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)![1]!
        // Emit font file to .next/static/media
        const selfHostedFileUrl = emitFontFile(
          fontFileBuffer,
          ext,
          preloadFontFile,
          !!adjustFontFallbackMetrics
        )

        return {
          googleFontFileUrl,
          selfHostedFileUrl,
        }
      })
    )

    /**
     * Replace the @font-face sources with the self-hosted files we just downloaded to .next/static/media
     *
     * E.g.
     * @font-face {
     *   font-family: 'Inter';
     *   src: url(https://fonts.gstatic.com/...) -> url(/_next/static/media/_.woff2)
     * }
     */
    let updatedCssResponse = fontFaceDeclarations
    for (const { googleFontFileUrl, selfHostedFileUrl } of downloadedFiles) {
      updatedCssResponse = updatedCssResponse.replace(
        new RegExp(escapeStringRegexp(googleFontFileUrl), 'g'),
        selfHostedFileUrl
      )
    }

    return {
      ...result,
      css: updatedCssResponse,
    }
  } catch (err) {
    if (isDev) {
      if (isServer) {
        ctx.error(
          `Failed to download \`${fontFamily}\` from Google Fonts. Using fallback font instead.\n\n${
            (err as Error).message
          }}`
        )
      }

      // In dev we should return the fallback font instead of throwing an error
      let css = `@font-face {
  font-family: '${fontFamily} Fallback';
  src: local("${adjustFontFallbackMetrics?.fallbackFont ?? 'Arial'}");`
      if (adjustFontFallbackMetrics) {
        css += `
  ascent-override:${adjustFontFallbackMetrics.ascentOverride};
  descent-override:${adjustFontFallbackMetrics.descentOverride};
  line-gap-override:${adjustFontFallbackMetrics.lineGapOverride};
  size-adjust:${adjustFontFallbackMetrics.sizeAdjust};`
      }
      css += '\n}'

      return {
        ...result,
        css,
      }
    } else {
      throw err
    }
  }
}

export default loader
