/*
import {
  type RolldownNextFontGoogleOptions,
  rolldownNextFontGoogle,
} from './plugin/google/rolldown'
import { nextJsFilePath, sanitizeFileName } from './plugin/util'
import { NEXT_FONT_LOADERS } from './constants'
import { type Plugin } from 'vite'
import { nextFontTransform } from './plugin/transform/rolldown'
import { prefixRegex } from '@rolldown/pluginutils'
import { rolldownNextFontLocal } from './plugin/local/rolldown'

const viteNextFont = (): Plugin[] => {
  const fontFileMap = new Map<string, Uint8Array>()
  const virtualSources = new Map<string, string | Promise<string>>()
  const entryFileToFontFiles = new Map<string, Set<string>>()

  const transformPlugin = nextFontTransform({
    fontLoaders: NEXT_FONT_LOADERS,
  })

  return [
    {
      name: 'next-font:virtual-source',
      async load(source) {
        if (virtualSources.has(source)) {
          return {
            code: await virtualSources.get(source)!,
            map: null,
          }
        }
        return null
      },
    },
    Object.assign({}, transformPlugin, {
      transform: Object.assign({}, transformPlugin.transform, {
        filter: {
          id: /\.(?:j|t)sx?$|\.(c|m)js$/,
        },
      }),
    }),
    ...rolldownNextFontGoogle({
      fontFileMap,
      virtualSources,
      entryFileToFontFiles,
    } satisfies Required<RolldownNextFontGoogleOptions>),
    {
      name: 'next-font:font-file-replacer',
      async config(config) {
        return {
          build: {
            rolldownOptions: {
              external: [
                prefixRegex(
                  `/${config.build?.assetsDir ?? 'assets'}/${sanitizeFileName(nextJsFilePath(''))}`
                ),
              ],
            },
          },
        }
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.originalUrl?.startsWith('/')
            ? req.originalUrl.slice(1)
            : req.originalUrl
          if (url != null && fontFileMap.has(url)) {
            const font = fontFileMap.get(url)
            return res.end(font)
          }
          next()
        })
      },
    } satisfies Plugin,
    rolldownNextFontLocal({
      virtualSources,
    }),
    rolldownNextFontManifest({
      fontFileMap,
      virtualSources,
      entryFileToFontFiles,
    }),
  ]
}

export default viteNextFont
*/
