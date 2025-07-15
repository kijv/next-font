import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataToEsm, normalizePath } from '@rollup/pluginutils'
import loaderUtils from 'loader-utils'
import MagicString from 'magic-string'
import type { FontLoader } from 'next-font'
import type { NextFontManifest } from 'next-font/manifest'
import queryString from 'query-string'
import { isCSSRequest, type PluginOption, type ResolvedConfig } from 'vite'
import type { FontImportDataQuery } from '@/ast/transform'
import type { Mutable, TargetCss } from '@/declarations'
import { nextFontPostcss } from '@/postcss'
import {
  createCachedImport,
  encodeURIPath,
  fontNameToUrl,
  getQuerySuffix,
  importResolve,
  normalizeTargetCssId,
  removeQuerySuffix,
  tryCatch,
} from '@/utils'

const googleLoader = createCachedImport<FontLoader>(() =>
  import('next-font/google/loader').then((mod) => mod.default)
)
const localLoader = createCachedImport<FontLoader>(() =>
  import('next-font/local/loader').then((mod) => mod.default)
)

export type OnFinished = (fileToFontNames: Map<string, Record<string, string[]>>) => Promise<void>

export const nextFontLoaderPlugin = ({
  nextFontManifest,
  fontImports,
  onFinished,
}: {
  nextFontManifest: Mutable<NextFontManifest>
  fontImports: Record<string, TargetCss[]>
  onFinished: OnFinished
}) => {
  let config: ResolvedConfig | null = null

  const fileToFontNames = new Map<string, Record<string, string[]>>()

  const loaderCache = {
    google: {
      css: new Map<string, string | null>(),
      font: new Map<string, string | null>(),
    },
    local: {
      css: new Map<string, string | null>(),
      font: new Map<string, string | null>(),
    },
  }
  const fontLoaders: [
    string,
    Promise<FontLoader> | FontLoader,
    (typeof loaderCache)[keyof typeof loaderCache],
  ][] = [
    ['next-font/google/target.css', googleLoader(), loaderCache.google],
    ['next-font/local/target.css', localLoader(), loaderCache.local],
  ] as const

  const targetCssMap = new Map<string, Awaited<ReturnType<typeof nextFontPostcss>>>()
  const removeTargetCss = (id: string) => {
    targetCssMap.delete(id)

    const { path: relativePathFromRoot } = queryString.parse(
      getQuerySuffix(id)
    ) as unknown as FontImportDataQuery
    const absPath = path.join(config!.root, relativePathFromRoot)

    const fontNames = fileToFontNames.get(absPath)?.[id]
    if (fontNames) {
      if (nextFontManifest[absPath]) {
        nextFontManifest[absPath] = nextFontManifest[absPath].filter(
          (font) => !fontNames.includes(font)
        )
      }

      for (const fontName of fontNames) {
        fontFileMap.set(
          fontNameToUrl(fontName),
          Object.assign({}, fontFileMap.get(fontNameToUrl(fontName)), {
            serve: false,
          })
        )
      }
    }
  }

  const fontFileMap = new Map<
    string,
    {
      content: Buffer
      serve: boolean
    }
  >()

  let lastEnv: string | null = null

  let calledFinished = false
  const resetCalledFinished = () => {
    calledFinished = false
  }

  return [
    { resetCalledFinished, removeTargetCss },
    [
      {
        name: 'next-fon:scan',
        enforce: 'pre',
        async configResolved(resolvedConfig) {
          config = resolvedConfig
        },
        configureServer(server) {
          return () => {
            server.middlewares.use((req, res, next) => {
              if (!req.originalUrl) return next()

              const font = fontFileMap.get(req.originalUrl)
              if (font?.serve) {
                res.end(font.content)
              } else next()
            })
          }
        },
      },
      {
        name: 'next-font:loader',
        load: {
          order: 'pre',
          async handler(id, opts) {
            if (!/\.css(?:$|\?)/.test(id)) return

            const { data: resolvedId, error } = await tryCatch(importResolve(removeQuerySuffix(id)))
            if (error) return null
            const pair = fontLoaders.find((id) => import.meta.resolve(id[0]) === resolvedId)
            if (!pair) return null

            const [, fontLoader, cache] = pair

            const normalizedId = normalizeTargetCssId(id)
            const isDev = config?.command === 'serve'

            if (
              // unnecessary to load the same file in dev mode
              isDev &&
              targetCssMap.has(normalizedId) &&
              lastEnv === this.environment.name
            )
              return
            lastEnv = this.environment.name

            const {
              path: relativePathFromRoot,
              import: functionName,
              arguments: stringifiedArguments,
              variableName,
            } = queryString.parse(getQuerySuffix(id)) as unknown as FontImportDataQuery & {
              arguments: string
            }

            const data = JSON.parse(stringifiedArguments)

            const fontNames: string[] = []

            const emitFontFile: Parameters<FontLoader>[0]['emitFontFile'] = (
              content: Buffer,
              ext: string,
              preload: boolean,
              isUsingSizeAdjust?: boolean
            ) => {
              const name = loaderUtils.interpolateName(
                // @ts-expect-error
                {},
                `static/media/[hash]${isUsingSizeAdjust ? '-s' : ''}${preload ? '.p' : ''}.${ext}`,
                {
                  content,
                }
              )

              fontNames.push(name)

              const outputPath = fontNameToUrl(name)

              if (!isDev) {
                this.emitFile({
                  type: 'asset',
                  fileName: outputPath.slice(1),
                  source: content,
                })
              }

              fontFileMap.set(outputPath, { content, serve: isDev })

              return outputPath
            }

            const absPath = path.join(config!.root, relativePathFromRoot)

            const fontData = await (await fontLoader)({
              functionName,
              variableName,
              data,
              emitFontFile,
              loaderContext: this,
              cache,
              isDev,
              isServer: opts?.ssr ?? false,
              resolve: (src) => {
                return path.join(path.dirname(absPath), src.startsWith('.') ? src : `./${src}`)
              },
            })

            fileToFontNames.set(absPath, {
              ...(fileToFontNames.get(absPath) || {}),
              [normalizedId]: Array.from(
                new Set((fileToFontNames.get(absPath)?.[normalizedId] || []).concat(fontNames))
              ),
            })

            const targetCss = await nextFontPostcss(relativePathFromRoot, fontData)

            if (fontImports[absPath]) {
              for (const fontImport of fontImports[absPath]) {
                if (
                  fileURLToPath(import.meta.resolve(removeQuerySuffix(fontImport.id))).concat(
                    getQuerySuffix(fontImport.id)
                  ) === encodeURIPath(id)
                ) {
                  fontImport.css = targetCss.code
                }
              }

              if (
                !calledFinished &&
                !Object.values(fontImports)
                  .flat()
                  .filter((i) => !i.css).length
              ) {
                await onFinished(fileToFontNames).finally(() => {
                  calledFinished = true
                })
              }
            }

            targetCssMap.set(normalizedId, targetCss)
          },
        },
        transform: {
          order: 'post',
          async handler(_code, id, opts) {
            if (!/\.css(?:$|\?)/.test(id)) return

            const normalizedId = normalizeTargetCssId(id)

            const targetCss = targetCssMap.get(normalizedId)
            if (!targetCss) return
            const { modules, code: css } = targetCss

            const modulesCode = dataToEsm(modules, {
              namedExports: true,
              preferConst: true,
            })

            const map = config?.css.devSourcemap
              ? new MagicString(css).generateMap({ hires: true })
              : undefined
            if (config?.command === 'serve' && !opts?.ssr) {
              const code = [
                `import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from ${JSON.stringify(
                  path.posix.join(config.base, '/@vite/client')
                )}`,
                `const __vite__id = ${JSON.stringify(id)}`,
                `const __vite__css = ${JSON.stringify(css)}`,
                `__vite__updateStyle(__vite__id, __vite__css)`,
                modulesCode,
                `if (import.meta.hot) {
                  import.meta.hot.accept()
                  import.meta.hot.prune(() => __vite__removeStyle(__vite__id))
                }`,
              ].join('\n')
              return {
                code,
                map,
              }
            }

            return {
              code: modulesCode,
              map,
              moduleSideEffects: false,
            }
          },
        },
      },
      {
        name: 'next-font:build',
        apply: 'build',
        renderChunk: {
          order: 'post',
          async handler(_code, chunk) {
            const resolvedModuleIds = (
              await Promise.all(
                chunk.moduleIds.map(async (moduleId) =>
                  this.resolve(moduleId).then((resolved) => resolved?.id)
                )
              )
            ).filter(Boolean) as string[]

            if (resolvedModuleIds.length) {
              const targetCss = resolvedModuleIds
                .map(
                  (id) =>
                    Object.assign({}, targetCssMap.get(normalizeTargetCssId(id)) ?? {}, { id }) as {
                      id: string
                      code?: string
                    }
                )
                .filter((t) => t != null && 'code' in t && typeof t.code === 'string')
              const chunkCSS = targetCss.map((t) => t.code).join()

              function ensureFileExt(name: string, ext: string) {
                return normalizePath(path.format({ ...path.parse(name), base: undefined, ext }))
              }

              if (chunkCSS) {
                const cssFullAssetName = ensureFileExt(chunk.name, '.css')
                // if facadeModuleId doesn't exist or doesn't have a CSS extension,
                // that means a JS entry file imports a CSS file.
                // in this case, only use the filename for the CSS chunk name like JS chunks.
                const cssAssetName =
                  chunk.isEntry && (!chunk.facadeModuleId || !isCSSRequest(chunk.facadeModuleId))
                    ? path.basename(cssFullAssetName)
                    : cssFullAssetName

                // emit corresponding css file
                const referenceId = this.emitFile({
                  type: 'asset',
                  name: cssAssetName,
                  source: chunkCSS,
                })
                chunk.viteMetadata!.importedCss.add(this.getFileName(referenceId))
              }
            }

            return null
          },
        },
      },
    ] as const satisfies PluginOption[],
  ] as const
}
