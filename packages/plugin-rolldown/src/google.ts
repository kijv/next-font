import {
  nextFontGoogleCssModuleReplacer,
  nextFontGoogleReplacer,
} from '@next-font/common/google/index'
import { NEXT_FONT_SOURCES } from '@next-font/common/plugin/constants'
import type { Plugin } from 'rolldown'
import { prefixRegex } from '@rolldown/pluginutils'
import { nextJsFilePath } from './util'

export interface RolldownNextFontGoogleOptions {
  fontFileMap?: Map<string, Uint8Array>
  virtualSources?: Map<string, string | Promise<string>>
  entryFileToFontFiles?: Map<string, Set<string>>
}

export function rolldownNextFontGoogle({
  fontFileMap = new Map(),
  virtualSources = new Map(),
  entryFileToFontFiles = new Map(),
}: RolldownNextFontGoogleOptions = {}): {
  name: string
  resolveId: {
    order: 'pre'
    filter?: {
      id: (RegExp | string) | (RegExp | string)[]
    }
    handler: (id: string, importer?: string) => Promise<string | null>
  }
}[] {
  const replacerMapping = nextFontGoogleReplacer({
    nextJsFilePath,
  })
  const cssModuleReplacer = nextFontGoogleCssModuleReplacer({
    nextJsFilePath,
    fontFileMap,
  })

  const targetCss = NEXT_FONT_SOURCES.map((mod) => `${mod}/google/target.css`)

  const fontEntryFiles = new Map<string, Set<string>>()
  const jsToEntryFiles = new Map<string, Set<string>>()

  return [
    {
      name: 'next-font-google:replacer',
      resolveId: {
        order: 'pre',
        filter: {
          id: targetCss.map((mod) => prefixRegex(`${mod}?`)),
        },
        async handler(id, importer): Promise<string | null> {
          const result = await replacerMapping(id)
          if (!result) return null

          virtualSources.set(result.path, result.content)
          if (importer) {
            fontEntryFiles.set(
              importer,
              (fontEntryFiles.get(importer) ?? new Set()).add(result.path)
            )
            jsToEntryFiles.set(
              result.path,
              (jsToEntryFiles.get(result.path) ?? new Set()).add(importer)
            )
          }

          return result.path
        },
      },
    },
    {
      name: 'next-font-google:css-module-replacer',
      resolveId: {
        order: 'pre',
        filter: {
          id: prefixRegex(
            '@vercel/turbopack-next/internal/font/google/cssmodule.module.css?'
          ),
        },
        async handler(id, importer): Promise<string | null> {
          const isBuild =
            'environment' in this &&
            this.environment != null &&
            typeof this.environment === 'object' &&
            'mode' in this.environment &&
            typeof this.environment.mode === 'string'
              ? this.environment.mode === 'build'
              : !this.meta.watchMode
          const result = await cssModuleReplacer.bind({
            build: isBuild,
            emitAsset: ({ name, source }) =>
              this.emitFile({ type: 'asset', name, source }),
            getFileName: this.getFileName.bind(this),
          })(id)
          if (!result) return null

          virtualSources.set(result.path, result.content)

          if (importer) {
            const importers = jsToEntryFiles.get(importer)
            if (importers) {
              for (const importer of importers) {
                const fontFiles =
                  entryFileToFontFiles.get(importer) ?? new Set()
                for (const dep of result.deps) {
                  fontFiles.add(dep)
                }
                entryFileToFontFiles.set(importer, fontFiles)
              }
            }
          }

          return result.path
        },
      },
    },
  ] satisfies Plugin[]
}
