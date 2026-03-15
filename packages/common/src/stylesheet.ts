import type { FontCssProperties } from './util'
import type { FontFallbacks } from './font-fallback'

const formatFixedPercentage = (value: number): string =>
  (value * 100).toFixed(2)

export const buildFallbackDefinition = async (
  fallbacks: FontFallbacks
): Promise<string> => {
  let res = ''

  for (const fallback of fallbacks.fallbacks) {
    if (fallback.type === 'automatic') {
      const { scopedFontFamily, localFontFamily, adjustment } = fallback.value

      const overrideProperties = adjustment
        ? `
                    ascent-override: ${formatFixedPercentage(adjustment.ascent)}%;
                    descent-override: ${formatFixedPercentage(Math.abs(adjustment.descent))}%;
                    line-gap-override: ${formatFixedPercentage(adjustment.lineGap)}%;
                    size-adjust: ${formatFixedPercentage(adjustment.sizeAdjust)}%;
                `
        : ''

      res += `
                @font-face {
                    font-family: '${scopedFontFamily}';
                    src: local("${localFontFamily}");
                    ${overrideProperties}
                }
            `
    }
  }

  return res
}

export const buildFontClassRules = async (
  cssProperties: FontCssProperties
): Promise<string> => {
  const fontFamilyString = cssProperties.fontFamily

  let rules = `
        .className {
            font-family: ${fontFamilyString};
            ${
              cssProperties.weight
                ? `font-weight: ${cssProperties.weight};\n`
                : ''
            }${
              cssProperties.style ? `font-style: ${cssProperties.style};\n` : ''
            }
        }
    `

  if (cssProperties.variable) {
    rules += `
        .variable {
            ${cssProperties.variable}: ${fontFamilyString};
        }
        `
  }

  return rules
}
