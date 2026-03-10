import {
  type RolldownNextFontGoogleOptions,
  rolldownNextFontGoogle,
} from './plugin/google/rolldown'
import { NEXT_FONT_LOADERS } from './constants'
import type { Plugin } from 'rolldown'
import { nextFontTransform } from './plugin/transform/rolldown'
import { rolldownNextFontLocal } from './plugin/local/rolldown'
import { rolldownNextFontManifest } from './plugin/manifest/rolldown'

const rolldownNextFont = (): Plugin[] => {
  const fontFileMap = new Map<string, Uint8Array>()
  const virtualSources = new Map<string, string | Promise<string>>()
  const entryFileToFontFiles = new Map<string, Set<string>>()

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
    nextFontTransform({
      fontLoaders: NEXT_FONT_LOADERS,
    }),
    ...rolldownNextFontGoogle({
      fontFileMap,
      virtualSources,
      entryFileToFontFiles,
    } satisfies Required<RolldownNextFontGoogleOptions>),
    rolldownNextFontLocal({ virtualSources }),
    rolldownNextFontManifest({
      fontFileMap,
      virtualSources,
      entryFileToFontFiles,
    }),
  ]
}

export default rolldownNextFont
