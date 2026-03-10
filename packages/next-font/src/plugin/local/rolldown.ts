import type { Plugin } from 'rolldown'
import { nextFontLocalResolvePlugin } from '@/core/local'

export const rolldownNextFontLocal = ({
  virtualSources = new Map(),
}: {
  virtualSources?: Map<string, string | Promise<string>>
} = {}) => {
  return nextFontLocalResolvePlugin({ virtualSources }) satisfies Plugin
}
