import type { Plugin } from 'rolldown'
import { nextFontLocalResolvePlugin } from '@next-font/common/local/index'

export const rolldownNextFontLocal = ({
  virtualSources = new Map(),
}: {
  virtualSources?: Map<string, string | Promise<string>>
} = {}): {
  name: string
  resolveId: {
    order: 'pre'
    handler: (id: string, importer?: string) => Promise<string | null>
  }
} => {
  return nextFontLocalResolvePlugin({ virtualSources }) satisfies Plugin
}
