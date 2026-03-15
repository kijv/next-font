import { NEXT_FONT_LOADERS } from '@next-font/common/plugin/constants'
import type { Plugin } from 'vite'
import { nextFontTransform } from '../../plugin-rolldown/src/transform'
import {
  type RolldownNextFontGoogleOptions,
  rolldownNextFontGoogle,
} from '../../plugin-rolldown/src/google'
import { rolldownNextFontLocal } from '../../plugin-rolldown/src/local'
import { rolldownNextFontManifest } from '../../plugin-rolldown/src/manifest'
import { prefixRegex } from 'vite/rolldown/pluginutils'
import { sanitizeFileName } from '@next-font/common/plugin/util'
import { nextJsFilePath } from '../../plugin-rolldown/src/util'

const viteNextFont = (): Plugin[] => {
  const fontFileMap = new Map<string, Uint8Array>()
  const virtualSources = new Map<string, string | Promise<string>>()
  const entryFileToFontFiles = new Map<string, Set<string>>()

  const rolldownTransformPlugin = nextFontTransform({
    fontLoaders: NEXT_FONT_LOADERS,
  })
  const transformPlugin = Object.assign({}, rolldownTransformPlugin, {
    transform: Object.assign({}, rolldownTransformPlugin.transform, {
      filter: {
        id: /\.(?:j|t)sx?$|\.(c|m)js$/,
      },
    }),
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
    transformPlugin,
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
