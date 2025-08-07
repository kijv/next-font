import type { Mutable, TargetCss } from '@/declarations'
import { type PluginOption, type ResolvedConfig, isCSSRequest } from 'vite'
import {
  createCachedImport,
  fontNameToUrl,
  getQuerySuffix,
  importResolve,
  isSamePath,
  normalizeTargetCssId,
  removeQuerySuffix,
  tryCatch,
} from '@/utils'
import { dataToEsm, normalizePath } from '@rollup/pluginutils'
import type { FontImportDataQuery } from '@/ast/transform'
import type { FontLoader } from 'next-font'
import MagicString from 'magic-string'
import type { NextFontManifest } from 'next-font/manifest'
import loaderUtils from 'loader-utils'
import { nextFontPostcss } from '@/postcss'
import path from 'node:path'
import queryString from 'query-string'

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
  const fontLoaders: {
    id: string
    loader: Promise<FontLoader> | FontLoader
    cache: (typeof loaderCache)[keyof typeof loaderCache]
  }[] = [
    {
      id: 'virtual:next-font/google/target.css',
      loader: googleLoader(),
      cache: loaderCache.google,
    },
    { id: 'virtual:next-font/local/target.css', loader: localLoader(), cache: loaderCache.local },
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
        name: 'next-font:loader:scan',
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
        resolveId(id) {
          if (!/\.css(?:$|\?)/.test(id)) return null

          if (fontLoaders.some((l) => id.startsWith(l.id))) {
            return '\0' + id
          }

          return null
        },
        load: {
          order: 'pre',
          async handler(id, opts) {
            if (!/\.css(?:$|\?)/.test(id)) return null

            const pair = fontLoaders.find((loader) => '\0' + loader.id === removeQuerySuffix(id))
            if (!pair) return null

            const { loader, cache } = pair

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

            const fontData = await (await loader)({
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

            const normalizedAbsPath = normalizePath(absPath)

            fileToFontNames.set(normalizedAbsPath, {
              ...fileToFontNames.get(normalizedAbsPath),
              [normalizedId]: Array.from(
                new Set(
                  (fileToFontNames.get(normalizedAbsPath)?.[normalizedId] || []).concat(fontNames)
                )
              ),
            })

            const targetCss = await nextFontPostcss(relativePathFromRoot, fontData)

            if (fontImports[normalizedAbsPath]) {
              for (const fontImport of fontImports[normalizedAbsPath]) {
                if (isSamePath(import.meta.resolve(removeQuerySuffix(fontImport.id)), id)) {
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

            return targetCss.code
          },
        },
        transform: {
          order: 'post',
          async handler(_code, id, opts) {
            if (!/\.css(?:$|\?)/.test(id)) return null

            const normalizedId = normalizeTargetCssId(id)

            const targetCss = targetCssMap.get(normalizedId)
            if (!targetCss) return null
            const { modules, code: css, exports } = targetCss

            const modulesCode = dataToEsm(
              Object.assign({}, modules, Object.fromEntries(exports.map((e) => [e.name, e.value]))),
              {
                namedExports: true,
                preferConst: true,
              }
            )

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
                `if (import.meta.hot) {`,
                [
                  `import.meta.hot.accept()`,
                  `import.meta.hot.prune(() => __vite__removeStyle(__vite__id))`,
                ]
                  .map((s) => `\t${s}`)
                  .join('\n'),
                `}`,
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
