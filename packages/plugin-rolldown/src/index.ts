import { NEXT_FONT_LOADERS } from '@next-font/common/plugin/constants'
import type { Plugin } from 'rolldown'
import { nextFontTransform } from './transform'
import { rolldownNextFontLocal } from './local'
import {
  rolldownNextFontGoogle,
  type RolldownNextFontGoogleOptions,
} from './google'
import { rolldownNextFontManifest } from './manifest'

const rolldownFont = (): Plugin[] => {
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

export default rolldownFont
