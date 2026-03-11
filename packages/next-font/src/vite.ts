import { type Plugin, version } from 'vite'
import {
  type RolldownNextFontGoogleOptions,
  rolldownNextFontGoogle,
} from './plugin/google/rolldown'
import { nextJsFilePath, sanitizeFileName } from './plugin/util'
import { NEXT_FONT_LOADERS } from './constants'
import { downUp } from 'rollxxx'
import { nextFontTransform } from './plugin/transform/rolldown'
import { prefixRegex } from '@rolldown/pluginutils'
import { rolldownNextFontLocal } from './plugin/local/rolldown'
import { rolldownNextFontManifest } from './plugin/manifest/rolldown'

const viteNextFont = (): Plugin[] => {
  const major = parseInt(version.split('.')[0] ?? '0', 10)

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

  const plugins: Plugin[] = [
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

  if (major < 8) return downUp.pluginsCompat(plugins) as Plugin[]

  return plugins
}

export default viteNextFont
