import type { Mutable, TargetCss } from './declarations'
import {
  type OnFinished,
  nextFontLoaderPlugin,
  nextFontManifestPlugin,
  nextFontTransformerPlugin,
} from './plugins'
import type { PluginOption, ViteDevServer } from 'vite'
import { getPageIsUsingSizeAdjust, getPreloadedFontFiles } from './manifest'
import { getQuerySuffix, normalizeTargetCssId, removeQuerySuffix } from './utils'
import type { NextFontManifest } from 'next-font/manifest'
import { fileURLToPath } from 'node:url'

const nextFont = (): PluginOption[] => {
  const servers: ViteDevServer[] = []

  const fontImports = new Proxy<Record<string, TargetCss[]>>(
    {},
    {
      get(t, p, r) {
        return Reflect.get(t, p, r)
      },
      set(t, p, v, r) {
        return Reflect.set(t, p, v, r)
      },
    }
  )

  const nextFontManifest = {
    isUsingSizeAdjust: false,
  } as Mutable<NextFontManifest>

  const reloadManifest = () => {
    for (const server of servers) {
      const manifestId = fileURLToPath(import.meta.resolve('next-font/manifest'))
      const manifestMod = server.moduleGraph.getModuleById(manifestId)
      if (manifestMod) {
        server.reloadModule(manifestMod)
        server.moduleGraph.invalidateModule(manifestMod)
        server.moduleGraph.onFileChange(manifestId)
        server.ws.send({
          type: 'full-reload',
          path: manifestId,
        })
      }
    }
  }

  const onFinished: OnFinished = async (fileToFontNames) => {
    for (const [id, targetCss] of fileToFontNames) {
      for (const fontFiles of Object.values(targetCss)) {
        // Look if size-adjust fallback font is being used
        if (!nextFontManifest.isUsingSizeAdjust) {
          nextFontManifest.isUsingSizeAdjust = getPageIsUsingSizeAdjust(fontFiles)
        }

        const preloadedFontFiles = getPreloadedFontFiles(fontFiles)

        // Add an entry of the module's font files in the manifest.
        // We'll add an entry even if no files should preload.
        // When an entry is present but empty, instead of preloading the font files, a preconnect tag is added.
        if (fontFiles.length > 0) {
          nextFontManifest[id] ||= []
          nextFontManifest[id] = Array.from(
            new Set(nextFontManifest[id].concat(preloadedFontFiles))
          )
        }
      }
    }

    reloadManifest()
  }

  const [{ resetCalledFinished, removeTargetCss }, loaderPlugin] = nextFontLoaderPlugin({
    nextFontManifest,
    fontImports,
    onFinished,
  })

  return [
    {
      name: 'next-font:scan',
      configureServer(server) {
        servers.push(server)
      },
    },
    nextFontTransformerPlugin({
      fontImports,
      onFontImportsChanged: async (_id, newValue, previousValue) => {
        resetCalledFinished()

        const removed = previousValue.filter((p) => !newValue.includes(p))

        for (const server of servers) {
          for (const id of removed) {
            const resolvedId =
              fileURLToPath(import.meta.resolve(removeQuerySuffix(id))) + getQuerySuffix(id)

            removeTargetCss(normalizeTargetCssId(resolvedId))

            const module = server.moduleGraph.getModuleById(resolvedId)
            if (module) {
              server.moduleGraph.onFileDelete(resolvedId)
              server.ws.send({
                type: 'prune',
                paths: [resolvedId],
              })
              server.ws.send({
                type: 'update',
                updates: [
                  {
                    type: 'css-update',
                    path: resolvedId,
                    acceptedPath: resolvedId,
                    timestamp: Date.now(),
                  },
                  {
                    type: 'css-update',
                    path: id,
                    acceptedPath: id,
                    timestamp: Date.now(),
                  },
                ],
              })
              // server.moduleGraph.invalidateModule(module)
              server.reloadModule(module)

              server.ws.send({
                type: 'full-reload',
                path: resolvedId,
              })
            }
          }

          reloadManifest()
        }
      },
    }),
    loaderPlugin,
    nextFontManifestPlugin({
      nextFontManifest,
    }),
  ] as PluginOption[]
}

export default nextFont
