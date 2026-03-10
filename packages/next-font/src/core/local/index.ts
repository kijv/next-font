import { type FontCssProperties, getRequestHash, getRequestId } from '../util'
import { type NextFontLocalOptions, optionsFromRequest } from './options'
import type { FontFallbacks } from '../font-fallback'
import { FontFileNotFound } from './errors'
import { NEXT_FONT_SOURCES } from '@/constants'
import type { NextFontLocalRequest } from './request'
import type { Plugin } from 'rolldown'
import { buildFontFamilyString } from './util'
import { buildStylesheet } from './stylehsheet'
import { cleanUrl } from '@/plugin/util'
import { getFontFallback } from './font-fallback'
import path from 'node:path'
import { prefixRegex } from '@rolldown/pluginutils'

export interface NextFontLocalFontFileOptions {
  path: string
  preload: boolean
  hasSizeAdjust: boolean
}

export const nextFontLocalResolvePlugin = ({
  virtualSources = new Map(),
}: {
  virtualSources?: Map<string, string | Promise<string>>
} = {}) => {
  return {
    name: 'next-font-local:resolve',
    resolveId: {
      order: 'pre',
      filter: {
        id: [prefixRegex('@vercel/turbopack-next/internal/font/local/')].concat(
          NEXT_FONT_SOURCES.map((src) => prefixRegex(`${src}/local/`))
        ),
      },
      async handler(source, importer) {
        if (!importer) return null
        const lookupPath = path.dirname(importer)

        const filePath = cleanUrl(source)
        const query =
          filePath !== source ? source.slice(filePath.length + 1) : ''
        if (!query) return null

        if (
          NEXT_FONT_SOURCES.map((src) => `${src}/local/target.css`).includes(
            filePath
          )
        ) {
          const requestHash = getRequestHash(query)
          const options = fontOptionsFromQueryMap(query)

          const fontFallbacks = await getFontFallback(lookupPath, options)
          if (fontFallbacks instanceof FontFileNotFound) {
            this.error(
              `Font file not found: Can't resolve '${fontFallbacks.field0}'`
            )
          }

          const properties = getFontCssProperties(options, fontFallbacks)
          const fileContent = `import cssModule from "@vercel/turbopack-next/internal/font/local/cssmodule.module.css?${new URLSearchParams(
            `${query.startsWith('?') ? '' : '?'}${query}`
          ).toString()}";
const fontData = {
  className: cssModule.className,
  style: {
    fontFamily: "${properties.fontFamily}",
    ${properties.weight ? `fontWeight: ${properties.weight}, ` : ''}${properties.style ? `fontStyle: "${properties.style}",` : ''}
  },
};

if (cssModule.variable != null) {
  fontData.variable = cssModule.variable;
}

export default fontData;`

          const jsVirtualPath = `\0${lookupPath.replace(/\/$/, '')}/${getRequestId(options.variableName, requestHash)}.js`

          virtualSources.set(jsVirtualPath, fileContent)

          return jsVirtualPath
        } else if (
          filePath ===
          '@vercel/turbopack-next/internal/font/local/cssmodule.module.css'
        ) {
          const requestHash = getRequestHash(query)
          const options = fontOptionsFromQueryMap(query)
          const cssVirtualPath = `${lookupPath.replace(/\/$/, '')}/${getRequestId(options.variableName, requestHash)}.module.css`
          const fallback = await getFontFallback(
            // oxlint-disable no-control-regex
            lookupPath.replace(/^\0/, ''),
            options
          )
          if (fallback instanceof FontFileNotFound) {
            return this.error(
              `Font file not found: Can't resolve '${fallback.field0}'`
            )
          }

          const stylesheet = buildStylesheet(
            options,
            fallback,
            getFontCssProperties(options, fallback),
            lookupPath
          )

          virtualSources.set(cssVirtualPath, stylesheet)

          return cssVirtualPath
        }

        return null
      },
    },
  } satisfies Plugin
}

function getFontCssProperties(
  options: NextFontLocalOptions,
  fontFallbacks: FontFallbacks
): FontCssProperties {
  return {
    fontFamily: buildFontFamilyString(options, fontFallbacks),
    weight: Array.isArray(options.fonts)
      ? undefined
      : options.fonts.weight?.type === 'fixed'
        ? options.fonts.weight.value
        : undefined,
    style: Array.isArray(options.fonts) ? undefined : options.fonts.style,
    variable: options.variable,
  }
}

function fontOptionsFromQueryMap(query: string): NextFontLocalOptions {
  const searchParams = new URLSearchParams(
    `${query.startsWith('?') ? '' : '?'}${query}`
  )

  if (searchParams.size !== 1) {
    throw new Error('next-font/local queries must have exactly one entry')
  }

  const entry = searchParams.entries().next().value?.[0]
  if (!entry) {
    throw new Error('Expected one entry')
  }

  return optionsFromRequest(JSON.parse(entry) as NextFontLocalRequest)
}
