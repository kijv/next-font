import { type FontCssProperties, getScopedFontFamily } from '../util'
import { buildFallbackDefinition, buildFontClassRules } from '../stylesheet'
import { FontFallbacks } from '../font-fallback'
import type { NextFontLocalOptions } from './options'
import { arraify } from '@/util'
import path from 'node:path'

export async function buildStylesheet(
  options: NextFontLocalOptions,
  fallbacks: FontFallbacks,
  cssProperties: FontCssProperties,
  lookupPath: string
): Promise<string> {
  const scopedFontFamily = getScopedFontFamily('webFont', options.variableName)

  return [
    await buildFontFaceDefinitions(scopedFontFamily, options, lookupPath),
    await buildFallbackDefinition(fallbacks),
    await buildFontClassRules(cssProperties),
  ].join('\n')
}

/// Builds a string of `@font-face` definitions for each local font file
export async function buildFontFaceDefinitions(
  scopedFontFamily: string,
  options: NextFontLocalOptions,
  lookupPath: string
): Promise<string> {
  let definitions = ''

  const fonts = arraify(options.fonts)

  for (const font of fonts) {
    // Check if `font-family` is explicitly defined in `declarations`
    const hasCustomFontFamily =
      options.declarations?.some(
        (declaration) => declaration.prop === 'font-family'
      ) ?? false

    const declarationLines = options.declarations
      ? options.declarations.map((d) => `${d.prop}: ${d.value};`).join('\n    ')
      : ''

    const fontFamilyLine = hasCustomFontFamily
      ? ''
      : `\n    font-family: '${scopedFontFamily}';`

    const weight = font.weight ?? options.defaultWeight
    const weightLine = weight
      ? `\n    font-weight: ${weight.type === 'variable' ? `${weight.start} ${weight.end}` : weight.value};`
      : ''

    const style = font.style ?? options.defaultStyle
    const styleLine = style ? `\n    font-style: ${style};` : ''

    definitions += `@font-face {
    ${declarationLines}${fontFamilyLine}
    src: url('${
      path.join(lookupPath.replace(/^\0/, ''), font.path) // oxlint-disable-line no-control-regex
    }') format('${extToFormat(font.ext)}');
    font-display: ${options.display};
    ${weightLine}${styleLine}
}\n`
  }

  return definitions
}

/// Used as e.g. `format('woff')` in `src` properties in `@font-face`
/// definitions above.
function extToFormat(ext: string): string {
  switch (ext) {
    case 'woff':
      return 'woff'
    case 'woff2':
      return 'woff2'
    case 'ttf':
      return 'truetype'
    case 'otf':
      return 'opentype'
    case 'eot':
      return 'embedded-opentype'
    default:
      throw new Error('Unknown font file extension')
  }
}
