import type { Plugin } from 'rolldown'
import type { RolldownNextFontGoogleOptions } from '@/plugin/google/rolldown'
import { cleanUrl } from '@/util'
import { nextJsFilePath } from '@/plugin/util'
import { prefixRegex } from '@rolldown/pluginutils'

export const rolldownNextFontManifest = ({
  fontFileMap,
  entryFileToFontFiles,
}: Required<RolldownNextFontGoogleOptions>) => {
  const manifestVirtualPath = `${nextJsFilePath('internal/font')}/manifest.js`

  return {
    name: 'next-font-google:font-manifest',
    resolveId: {
      order: 'pre',
      async handler(id, importer) {
        try {
          if (
            import.meta.resolve(id) ===
            import.meta.resolve('next-font/manifest')
          ) {
            return `\0${manifestVirtualPath}${importer != null && importer.length > 0 ? `?importer=${encodeURIComponent(importer)}` : ''}`
          }
        } catch {}
      },
    },
    load: {
      order: 'pre',
      filter: {
        id: prefixRegex(`\0${manifestVirtualPath}`),
      },
      async handler(id) {
        const filePath = cleanUrl(id)
        const query = filePath !== id ? id.slice(filePath.length + 1) : ''
        if (!query) return null

        const importer =
          decodeURIComponent(
            new URLSearchParams(`?${query}`).get('importer') ?? ''
          ) || null

        const fontFiles = Array.from(fontFileMap.keys())
        const usingSizeAdjust = fontFiles.some((file) => file.includes('-s'))

        const nextFontManifest: {
          app: Record<string, string[]>
          usingSizeAdjust: boolean
        } =
          fontFileMap.size > 0
            ? {
                app: Object.fromEntries(
                  Array.from(entryFileToFontFiles).map(
                    ([entryFile, fontFiles]) => [
                      entryFile,
                      Array.from(fontFiles).filter(
                        (file) => !file.includes('.p.')
                      ),
                    ]
                  )
                ),
                usingSizeAdjust,
              }
            : {
                app: {},
                usingSizeAdjust: false,
              }

        return `const nextFontManifest = Object.freeze(${JSON.stringify(nextFontManifest)});
export function getPreloadableFonts(filePath${importer ? ` = ${JSON.stringify(importer)}` : ''}) {
  if (!filePath) return null
  const filepathWithoutExtension = filePath.replace(/\\.[^.]+$/, '')
  const fontFiles = new Set()
  let foundFontUsage = false

  const preloadedFontFiles = nextFontManifest.app[filepathWithoutExtension]
  if (preloadedFontFiles) {
    foundFontUsage = true
    for (const fontFile of preloadedFontFiles) {
      if (!injectedFontPreloadTags.has(fontFile)) {
        fontFiles.add(fontFile)
        injectedFontPreloadTags.add(fontFile)
      }
    }
  }
  if (fontFiles.size) {
    return [...fontFiles].sort()
  } else if (foundFontUsage && injectedFontPreloadTags.size === 0) {
    return []
  } else {
    return null
  }
}
export default { getPreloadableFonts }`
      },
    },
  } satisfies Plugin
}
